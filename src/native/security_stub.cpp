#include <napi.h>

/**
 * Aegis Vault - Native Security Addon (Stub for non-Windows)
 * 
 * Provides no-op implementations for macOS/Linux builds where 
 * Windows DPAPI and VirtualLock are not directly available 
 * or handled differently.
 */

Napi::Boolean LockMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // Not implemented on this platform
    return Napi::Boolean::New(env, true);
}

Napi::Boolean UnlockMemory(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // Not implemented on this platform
    return Napi::Boolean::New(env, true);
}

Napi::Value ProtectData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    // Return null to signal that hardware binding is not available
    // The JS side should handle this gracefully (fallback to standard encryption)
    return env.Null();
}

Napi::Value UnprotectData(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
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
