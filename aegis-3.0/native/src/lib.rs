use neon::prelude::*;

mod crypto;
mod db;
mod memory;
mod biometrics;
mod p2p;
mod security_audit;
mod tpm_time;

use crypto::{aes_encrypt, aes_decrypt, argon2_derive, pqc_encrypt, pqc_decrypt, generate_keypair};
use db::DatabaseManager;
use std::sync::{Arc, RwLock};
use once_cell::sync::Lazy;

static DB: Lazy<RwLock<Option<Arc<DatabaseManager>>>> = Lazy::new(|| RwLock::new(None));
static P2P: Lazy<RwLock<Option<Arc<p2p::AegisP2PNode>>>> = Lazy::new(|| RwLock::new(None));

fn js_db_open(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let path = cx.argument::<JsString>(0)?.value(&mut cx);
    let password = cx.argument::<JsString>(1)?.value(&mut cx);
    
    match DatabaseManager::open(path, &password) {
        Ok(db) => {
            let mut db_lock = DB.write().unwrap();
            *db_lock = Some(Arc::new(db));
            Ok(cx.boolean(true))
        },
        Err(e) => cx.throw_error(format!("Failed to open database: {}", e)),
    }
}

fn js_db_close(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let mut db_lock = DB.write().unwrap();
    *db_lock = None;
    Ok(cx.boolean(true))
}

fn js_db_get_all(mut cx: FunctionContext) -> JsResult<JsArray> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    match db.get_all_entries() {
        Ok(entries) => {
            let arr = JsArray::new(&mut cx, entries.len());
            for (i, (id, title, username, data, tags, category)) in entries.into_iter().enumerate() {
                let obj = cx.empty_object();
                let id_js = cx.string(id);
                let title_js = cx.string(title);
                let username_js: Handle<JsValue> = match username {
                    Some(u) => cx.string(u).upcast(),
                    None => cx.null().upcast(),
                };
                let data_hex_js = cx.string(hex::encode(data));
                
                let tags_js: Handle<JsValue> = match tags {
                    Some(t) => cx.string(t).upcast(),
                    None => cx.null().upcast(),
                };

                let category_js: Handle<JsValue> = match category {
                    Some(c) => cx.string(c).upcast(),
                    None => cx.null().upcast(),
                };

                obj.set(&mut cx, "id", id_js)?;
                obj.set(&mut cx, "title", title_js)?;
                obj.set(&mut cx, "username", username_js)?;
                obj.set(&mut cx, "data", data_hex_js)?;
                obj.set(&mut cx, "tags", tags_js)?;
                obj.set(&mut cx, "category", category_js)?;
                
                arr.set(&mut cx, i as u32, obj)?;
            }
            Ok(arr)
        },
        Err(e) => cx.throw_error(format!("Failed to get entries: {}", e)),
    }
}

fn js_db_save(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let id = cx.argument::<JsString>(0)?.value(&mut cx);
    let title = cx.argument::<JsString>(1)?.value(&mut cx);
    
    let username = if cx.len() > 2 {
        cx.argument::<JsValue>(2)?.downcast::<JsString, _>(&mut cx).ok().map(|s| s.value(&mut cx))
    } else { None };

    let data_hex = cx.argument::<JsString>(3)?.value(&mut cx);

    let tags = if cx.len() > 4 {
        cx.argument::<JsValue>(4)?.downcast::<JsString, _>(&mut cx).ok().map(|s| s.value(&mut cx))
    } else { None };

    let category = if cx.len() > 5 {
        cx.argument::<JsValue>(5)?.downcast::<JsString, _>(&mut cx).ok().map(|s| s.value(&mut cx))
    } else { None };

    let data = hex::decode(data_hex)
        .or_else(|_| cx.throw_error("Invalid data hex"))?;

    match db.save_entry(&id, &title, username.as_deref(), &data, tags.as_deref(), category.as_deref()) {
        Ok(_) => Ok(cx.undefined()),
        Err(e) => cx.throw_error(format!("Failed to save entry: {}", e)),
    }
}

fn js_aes_encrypt(mut cx: FunctionContext) -> JsResult<JsString> {
    let plaintext = cx.argument::<JsString>(0)?.value(&mut cx);
    let key_hex = cx.argument::<JsString>(1)?.value(&mut cx);
    let key = hex::decode(key_hex).or_else(|_| cx.throw_error("Invalid key hex"))?;
    
    match aes_encrypt(plaintext.as_bytes(), &key) {
        Ok(data) => Ok(cx.string(hex::encode(data))),
        Err(e) => cx.throw_error(e.to_string()),
    }
}

fn js_aes_decrypt(mut cx: FunctionContext) -> JsResult<JsString> {
    let ciphertext_hex = cx.argument::<JsString>(0)?.value(&mut cx);
    let key_hex = cx.argument::<JsString>(1)?.value(&mut cx);
    let ciphertext = hex::decode(ciphertext_hex).or_else(|_| cx.throw_error("Invalid ciphertext hex"))?;
    let key = hex::decode(key_hex).or_else(|_| cx.throw_error("Invalid key hex"))?;

    match aes_decrypt(&ciphertext, &key) {
        Ok(data) => Ok(cx.string(String::from_utf8_lossy(&data))),
        Err(e) => cx.throw_error(e.to_string()),
    }
}

fn js_argon2_derive(mut cx: FunctionContext) -> JsResult<JsString> {
    let password = cx.argument::<JsString>(0)?.value(&mut cx);
    let salt = cx.argument::<JsString>(1)?.value(&mut cx);
    
    match argon2_derive(password.as_bytes(), salt.as_bytes()) {
        Ok(key) => Ok(cx.string(hex::encode(key))),
        Err(e) => cx.throw_error(e.to_string()),
    }
}

fn js_pqc_encrypt(mut cx: FunctionContext) -> JsResult<JsString> {
    let plaintext_hex = cx.argument::<JsString>(0)?.value(&mut cx);
    let public_key_hex = cx.argument::<JsString>(1)?.value(&mut cx);
    
    let plaintext = hex::decode(plaintext_hex).or_else(|_| cx.throw_error("Invalid plaintext hex"))?;
    let public_key = hex::decode(public_key_hex).or_else(|_| cx.throw_error("Invalid public key hex"))?;

    match pqc_encrypt(&plaintext, &public_key) {
        Ok(data) => Ok(cx.string(hex::encode(data))),
        Err(e) => cx.throw_error(e.to_string()),
    }
}

fn js_pqc_decrypt(mut cx: FunctionContext) -> JsResult<JsString> {
    let ciphertext_hex = cx.argument::<JsString>(0)?.value(&mut cx);
    let secret_key_hex = cx.argument::<JsString>(1)?.value(&mut cx);
    
    let ciphertext = hex::decode(ciphertext_hex).or_else(|_| cx.throw_error("Invalid ciphertext hex"))?;
    let secret_key = hex::decode(secret_key_hex).or_else(|_| cx.throw_error("Invalid secret key hex"))?;

    match pqc_decrypt(&ciphertext, &secret_key) {
        Ok(data) => Ok(cx.string(hex::encode(data))),
        Err(e) => cx.throw_error(e.to_string()),
    }
}

fn js_generate_pqc_keypair(mut cx: FunctionContext) -> JsResult<JsObject> {
    let (pk, sk) = generate_keypair();
    let obj = cx.empty_object();
    let pk_js = cx.string(hex::encode(pk));
    let sk_js = cx.string(hex::encode(sk));
    obj.set(&mut cx, "publicKey", pk_js)?;
    obj.set(&mut cx, "secretKey", sk_js)?;
    Ok(obj)
}

fn js_db_delete(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let id = cx.argument::<JsString>(0)?.value(&mut cx);

    match db.delete_entry(&id) {
        Ok(_) => Ok(cx.undefined()),
        Err(e) => cx.throw_error(format!("Failed to delete entry: {}", e)),
    }
}

fn js_db_is_open(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    Ok(cx.boolean(DB.read().unwrap().is_some()))
}

fn js_generate_mnemonic(mut cx: FunctionContext) -> JsResult<JsString> {
    Ok(cx.string(crypto::generate_mnemonic_24()))
}

fn js_validate_mnemonic(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let phrase = cx.argument::<JsString>(0)?.value(&mut cx);
    Ok(cx.boolean(crypto::validate_mnemonic(&phrase)))
}

fn js_mnemonic_to_entropy(mut cx: FunctionContext) -> JsResult<JsString> {
    let phrase = cx.argument::<JsString>(0)?.value(&mut cx);
    match crypto::mnemonic_to_entropy(&phrase) {
        Ok(entropy) => Ok(cx.string(hex::encode(entropy))),
        Err(e) => cx.throw_error(e),
    }
}

fn js_db_set_metadata(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let key = cx.argument::<JsString>(0)?.value(&mut cx);
    let value = cx.argument::<JsString>(1)?.value(&mut cx);

    match db.set_metadata(&key, &value) {
        Ok(_) => Ok(cx.undefined()),
        Err(e) => cx.throw_error(format!("Failed to set metadata: {}", e)),
    }
}
fn js_db_get_metadata(mut cx: FunctionContext) -> JsResult<JsValue> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let key = cx.argument::<JsString>(0)?.value(&mut cx);

    match db.get_metadata(&key) {
        Ok(Some(value)) => Ok(cx.string(value).upcast()),
        Ok(None) => Ok(cx.null().upcast()),
        Err(e) => cx.throw_error(format!("Failed to get metadata: {}", e)),
    }
}

// ==================== EMERGENCY CONTACTS ====================

fn js_db_get_emergency_contacts(mut cx: FunctionContext) -> JsResult<JsArray> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    match db.get_all_emergency_contacts() {
        Ok(contacts) => {
            let arr = JsArray::new(&mut cx, contacts.len());
            for (i, (id, name, email, period, status, last_req, data)) in contacts.into_iter().enumerate() {
                let obj = cx.empty_object();
                let id_js = cx.string(id);
                let name_js = cx.string(name);
                let email_js = cx.string(email);
                let period_js = cx.number(period as f64);
                let status_js = cx.string(status);
                let last_req_js: Handle<JsValue> = match last_req {
                    Some(t) => cx.number(t as f64).upcast(),
                    None => cx.null().upcast(),
                };
                let data_js: Handle<JsValue> = match data {
                    Some(d) => cx.string(hex::encode(d)).upcast(),
                    None => cx.null().upcast(),
                };

                obj.set(&mut cx, "id", id_js)?;
                obj.set(&mut cx, "name", name_js)?;
                obj.set(&mut cx, "email", email_js)?;
                obj.set(&mut cx, "waitingPeriod", period_js)?;
                obj.set(&mut cx, "status", status_js)?;
                obj.set(&mut cx, "lastRequestAt", last_req_js)?;
                obj.set(&mut cx, "data", data_js)?;
                
                arr.set(&mut cx, i as u32, obj)?;
            }
            Ok(arr)
        },
        Err(e) => cx.throw_error(format!("Failed to get emergency contacts: {}", e)),
    }
}

fn js_db_save_emergency_contact(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let id = cx.argument::<JsString>(0)?.value(&mut cx);
    let name = cx.argument::<JsString>(1)?.value(&mut cx);
    let email = cx.argument::<JsString>(2)?.value(&mut cx);
    let waiting_period = cx.argument::<JsNumber>(3)?.value(&mut cx) as i64;
    let status = cx.argument::<JsString>(4)?.value(&mut cx);
    
    let last_request_at = if cx.len() > 5 && !cx.argument::<JsValue>(5)?.is_a::<JsNull, _>(&mut cx) {
        Some(cx.argument::<JsNumber>(5)?.value(&mut cx) as i64)
    } else { None };

    let data_hex = if cx.len() > 6 && !cx.argument::<JsValue>(6)?.is_a::<JsNull, _>(&mut cx) {
        Some(cx.argument::<JsString>(6)?.value(&mut cx))
    } else { None };

    let data = data_hex.map(|h| hex::decode(h).unwrap_or_default());

    match db.save_emergency_contact(&id, &name, &email, waiting_period, &status, last_request_at, data.as_deref()) {
        Ok(_) => Ok(cx.undefined()),
        Err(e) => cx.throw_error(format!("Failed to save emergency contact: {}", e)),
    }
}

fn js_db_delete_emergency_contact(mut cx: FunctionContext) -> JsResult<JsUndefined> {
    let db_lock = DB.read().unwrap();
    let db = match db_lock.as_ref() {
        Some(db) => db,
        None => return cx.throw_error("Database not open"),
    };

    let id = cx.argument::<JsString>(0)?.value(&mut cx);

    match db.delete_emergency_contact(&id) {
        Ok(_) => Ok(cx.undefined()),
        Err(e) => cx.throw_error(format!("Failed to delete emergency contact: {}", e)),
    }
}

#[cfg(test)]
mod fuzz_test;

fn js_p2p_start(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let mut p2p_lock = P2P.write().unwrap();
    if p2p_lock.is_some() {
        return Ok(cx.boolean(true));
    }

    match p2p::AegisP2PNode::new() {
        Ok(node) => {
            let shared_node = Arc::new(node);
            let node_to_run = shared_node.clone();
            
            // Run node in a separate thread
            std::thread::spawn(move || {
                if let Err(e) = node_to_run.start() {
                    eprintln!("P2P Node error: {}", e);
                }
            });

            *p2p_lock = Some(shared_node);
            Ok(cx.boolean(true))
        },
        Err(e) => cx.throw_error(format!("Failed to start P2P node: {}", e)),
    }
}

fn js_p2p_stop(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let mut p2p_lock = P2P.write().unwrap();
    *p2p_lock = None;
    Ok(cx.boolean(true))
}

fn js_p2p_get_status(mut cx: FunctionContext) -> JsResult<JsObject> {
    let p2p_lock = P2P.read().unwrap();
    let obj = cx.empty_object();
    
    match p2p_lock.as_ref() {
        Some(_node) => {
            let active = cx.boolean(true);
            let peer_id = cx.string("Discovered via mDNS"); // Placeholder for actual peer count/list
            obj.set(&mut cx, "active", active)?;
            obj.set(&mut cx, "status", peer_id)?;
        },
        None => {
            let active = cx.boolean(false);
            obj.set(&mut cx, "active", active)?;
        }
    }
    
    Ok(obj)
}

#[neon::main]
fn main(mut cx: ModuleContext) -> NeonResult<()> {
    cx.export_function("aesEncrypt", js_aes_encrypt)?;
    cx.export_function("aesDecrypt", js_aes_decrypt)?;
    cx.export_function("argon2Derive", js_argon2_derive)?;
    cx.export_function("pqcEncrypt", js_pqc_encrypt)?;
    cx.export_function("pqcDecrypt", js_pqc_decrypt)?;
    cx.export_function("pqcGenerateKeypair", js_generate_pqc_keypair)?;
    cx.export_function("p2pStart", js_p2p_start)?;
    cx.export_function("p2pStop", js_p2p_stop)?;
    cx.export_function("p2pGetStatus", js_p2p_get_status)?;
    cx.export_function("dbOpen", js_db_open)?;
    cx.export_function("dbSave", js_db_save)?;
    cx.export_function("dbGetAll", js_db_get_all)?;
    cx.export_function("dbDelete", js_db_delete)?;
    cx.export_function("dbIsOpen", js_db_is_open)?;
    cx.export_function("dbClose", js_db_close)?;
    cx.export_function("generateMnemonic", js_generate_mnemonic)?;
    cx.export_function("validateMnemonic", js_validate_mnemonic)?;
    cx.export_function("mnemonicToEntropy", js_mnemonic_to_entropy)?;
    cx.export_function("dbSetMetadata", js_db_set_metadata)?;
    cx.export_function("dbGetMetadata", js_db_get_metadata)?;
    cx.export_function("dbGetEmergencyContacts", js_db_get_emergency_contacts)?;
    cx.export_function("dbSaveEmergencyContact", js_db_save_emergency_contact)?;
    cx.export_function("dbDeleteEmergencyContact", js_db_delete_emergency_contact)?;
    cx.export_function("checkBiometrics", biometrics::js_check_biometrics)?;
    cx.export_function("getTimeContext", js_get_time_context)?;
    cx.export_function("verifyTime", js_verify_time)?;
    cx.export_function("isTpmAvailable", js_is_tpm_available)?;
    Ok(())
}

fn js_is_tpm_available(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    Ok(cx.boolean(tpm_time::is_tpm_available()))
}

fn js_get_time_context(mut cx: FunctionContext) -> JsResult<JsObject> {
    let (system, tick) = tpm_time::get_hardware_time_context();
    let obj = cx.empty_object();
    let system_js = cx.number(system as f64);
    let tick_js = cx.number(tick as f64);
    obj.set(&mut cx, "systemTime", system_js)?;
    obj.set(&mut cx, "tickCount", tick_js)?;
    Ok(obj)
}

fn js_verify_time(mut cx: FunctionContext) -> JsResult<JsObject> {
    let stored_system = cx.argument::<JsNumber>(0)?.value(&mut cx) as u64;
    let stored_tick = cx.argument::<JsNumber>(1)?.value(&mut cx) as u64;
    
    let result = tpm_time::verify_time_integrity(stored_system, stored_tick);
    let obj = cx.empty_object();
    
    match result {
        Ok((current_system, current_tick)) => {
            let success = cx.boolean(true);
            let sys = cx.number(current_system as f64);
            let tick = cx.number(current_tick as f64);
            obj.set(&mut cx, "success", success)?;
            obj.set(&mut cx, "systemTime", sys)?;
            obj.set(&mut cx, "tickCount", tick)?;
        },
        Err(e) => {
            let success = cx.boolean(false);
            let error = cx.string(e);
            obj.set(&mut cx, "success", success)?;
            obj.set(&mut cx, "error", error)?;
        }
    }
    
    Ok(obj)
}
