#include <napi.h>
#include <windows.h>

/**
 * Aegis Vault - Native Security Addon (Windows)
 * This addon provides memory page locking to prevent sensitive data 
 * from being swapped to disk (PageFile.sys).
 */

Napi::Boolean LockMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();
    
    // Call Win32 VirtualLock
    // This locks the specified region of the process's virtual address space into physical memory.
    BOOL success = VirtualLock(buffer.Data(), buffer.Length());

    return Napi::Boolean::New(env, success ? true : false);
}

Napi::Boolean UnlockMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return Napi::Boolean::New(env, false);
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();

    BOOL success = VirtualUnlock(buffer.Data(), buffer.Length());

    return Napi::Boolean::New(env, success ? true : false);
}

Napi::Value ProtectData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();

    DATA_BLOB dataIn;
    dataIn.pbData = buffer.Data();
    dataIn.cbData = (DWORD)buffer.Length();

    DATA_BLOB dataOut;
    // SECURITY: Use CRYPTPROTECT_UI_FORBIDDEN to ensure no UI prompts
    // Use CRYPTPROTECT_LOCAL_MACHINE | CRYPTPROTECT_AUDIT if we want machine-wide,
    // but default (User-bound) is better for password managers.
    if (CryptProtectData(&dataIn, L"AegisVaultHardwareBinding", NULL, NULL, NULL, 0, &dataOut)) {
        Napi::Buffer<uint8_t> result = Napi::Buffer<uint8_t>::Copy(env, dataOut.pbData, dataOut.cbData);
        LocalFree(dataOut.pbData);
        return result;
    }

    return env.Null();
}

Napi::Value UnprotectData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsBuffer()) {
        Napi::TypeError::New(env, "Buffer expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = info[0].As<Napi::Buffer<uint8_t>>();

    DATA_BLOB dataIn;
    dataIn.pbData = buffer.Data();
    dataIn.cbData = (DWORD)buffer.Length();

    DATA_BLOB dataOut;
    if (CryptUnprotectData(&dataIn, NULL, NULL, NULL, NULL, 0, &dataOut)) {
        Napi::Buffer<uint8_t> result = Napi::Buffer<uint8_t>::Copy(env, dataOut.pbData, dataOut.cbData);
        LocalFree(dataOut.pbData);
        return result;
    }

    return env.Null();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "lockMemory"), Napi::Function::New(env, LockMemory));
    exports.Set(Napi::String::New(env, "unlockMemory"), Napi::Function::New(env, UnlockMemory));
    exports.Set(Napi::String::New(env, "protectData"), Napi::Function::New(env, ProtectData));
    exports.Set(Napi::String::New(env, "unprotectData"), Napi::Function::New(env, UnprotectData));
    return exports;
}

NODE_API_MODULE(aegis_security, Init)
