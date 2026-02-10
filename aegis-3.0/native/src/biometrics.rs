use neon::prelude::*;

pub fn js_check_biometrics(mut cx: FunctionContext) -> JsResult<JsBoolean> {
    #[cfg(target_os = "windows")]
    {
        // Windows Hello
        return Ok(cx.boolean(true));
    }

    #[cfg(target_os = "macos")]
    {
        // Touch ID (via LocalAuthentication framework)
        // For alpha, we assume it's available if OS version supports it
        // Real impl would involve linking Security.framework
        println!("Checking Touch ID support...");
        return Ok(cx.boolean(true));
    }

    #[cfg(target_os = "linux")]
    {
        // Linux fprintd check
        // We can check if /usr/bin/fprintd-verify exists
        use std::path::Path;
        let has_fprint = Path::new("/usr/bin/fprintd-verify").exists();
        return Ok(cx.boolean(has_fprint));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Ok(cx.boolean(false))
    }
}
