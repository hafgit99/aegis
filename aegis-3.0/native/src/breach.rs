use neon::prelude::*;
use std::fs::File;
use memmap2::Mmap;
use std::path::Path;

/// Perform a binary search on a memory-mapped file containing sorted 20-byte SHA-1 hashes.
/// This approach is O(log n) and uses zero additional memory regardless of file size.
pub fn js_check_breach_offline(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    let sha1_hex = cx.argument::<JsString>(0)?.value(&mut cx);
    let db_path_str = cx.argument::<JsString>(1)?.value(&mut cx);

    let sha1_bytes = match hex::decode(&sha1_hex) {
        Ok(b) => b,
        Err(_) => return cx.throw_error("Invalid SHA-1 hex"),
    };

    if sha1_bytes.len() != 20 {
        return cx.throw_error("SHA-1 must be 20 bytes");
    }

    let path = Path::new(&db_path_str);
    if !path.exists() {
        return Ok(cx.boolean(false));
    }

    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return Ok(cx.boolean(false)),
    };

    let mmap = match unsafe { Mmap::map(&file) } {
        Ok(m) => m,
        Err(_) => return Ok(cx.boolean(false)),
    };

    // Each SHA-1 hash is 20 bytes. The file MUST be a multiple of 20 bytes.
    let record_size = 20;
    let num_records = mmap.len() / record_size;

    if num_records == 0 {
        return Ok(cx.boolean(false));
    }

    let mut low = 0;
    let mut high = num_records - 1;

    while low <= high {
        let mid = low + (high - low) / 2;
        let offset = mid * record_size;
        let mid_val = &mmap[offset..offset + record_size];

        if mid_val == sha1_bytes.as_slice() {
            return Ok(cx.boolean(true));
        } else if mid_val < sha1_bytes.as_slice() {
            low = mid + 1;
        } else {
            if mid == 0 { break; }
            high = mid - 1;
        }
    }

    Ok(cx.boolean(false))
}
