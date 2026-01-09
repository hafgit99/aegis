#include <node_api.h>
#include <windows.h>
#include <stdio.h>

/**
 * Aegis Vault - Native Security Addon (Windows)
 * This addon provides memory page locking to prevent sensitive data 
 * from being swapped to disk (PageFile.sys).
 */

napi_value LockMemory(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* buffer;
    size_t length;

    // Get the buffer from arguments
    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    napi_get_typedarray_info(env, args[0], NULL, &length, &buffer, NULL, NULL);

    // Call Win32 VirtualLock
    // This locks the specified region of the process's virtual address space into physical memory.
    BOOL success = VirtualLock(buffer, length);

    napi_value result;
    napi_get_boolean(env, success, &result);
    return result;
}

napi_value UnlockMemory(napi_env env, napi_callback_info info) {
    size_t argc = 1;
    napi_value args[1];
    void* buffer;
    size_t length;

    napi_get_cb_info(env, info, &argc, args, NULL, NULL);
    napi_get_typedarray_info(env, args[0], NULL, &length, &buffer, NULL, NULL);

    BOOL success = VirtualUnlock(buffer, length);

    napi_value result;
    napi_get_boolean(env, success, &result);
    return result;
}

napi_value Init(napi_env env, napi_value exports) {
    napi_property_descriptor desc[] = {
        { "lockMemory", 0, LockMemory, 0, 0, 0, napi_default, 0 },
        { "unlockMemory", 0, UnlockMemory, 0, 0, 0, napi_default, 0 }
    };
    napi_define_properties(env, exports, 2, desc);
    return exports;
}

NAPI_MODULE(NODE_GYP_MODULE_NAME, Init)
