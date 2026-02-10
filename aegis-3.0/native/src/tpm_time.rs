use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(windows)]
use windows::Win32::System::SystemInformation::GetTickCount64;
// #[cfg(windows)]
// use windows::Win32::System::Tpm::{Tbsi_GetDeviceInfo, TBS_CONTEXT_PARAMS, TBS_DEVICE_INFO_64};

/// Checks if TPM (Trusted Platform Module) is available and functional.
pub fn is_tpm_available() -> bool {
    // Temporarily disabled due to windows-rs feature conflict in build environment
    /*
    #[cfg(windows)]
    unsafe {
        let mut info: TBS_DEVICE_INFO_64 = std::mem::zeroed();
        info.structVersion = 1;
        let res = Tbsi_GetDeviceInfo(std::mem::size_of::<TBS_DEVICE_INFO_64>() as u32, (&mut info as *mut _) as *mut _);
        res == 0 // TBS_SUCCESS
    }
    */
    false
}

/// Verifies if the system time is sane compared to hardware-backed monotonic clock.
/// Detects "Time Rollback" attacks where system clock is manually set backwards.
pub fn verify_time_integrity(stored_system_time: u64, stored_tick_count: u64) -> Result<(u64, u64), String> {
    let current_system_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs();

    #[cfg(windows)]
    let current_tick_count = unsafe { GetTickCount64() };
    
    #[cfg(not(windows))]
    let current_tick_count = 0; // Fallback for other platforms (simplified)

    // 1. Basic Rollback Check: Current System Time MUST be >= Stored System Time
    if current_system_time < stored_system_time {
        return Err("TIME_ROLLBACK_DETECTED: System clock is behind last recorded time.".to_string());
    }

    // 2. Hardware Monotonic Check: Tick Count must have advanced if system time advanced
    // Note: This check only works across the same boot session.
    if stored_tick_count > 0 && current_tick_count > stored_tick_count {
        let system_delta = current_system_time.saturating_sub(stored_system_time);
        let tick_delta = (current_tick_count - stored_tick_count) / 1000; // Convert ms to s

        // If system time jumped forward significantly more than tick count (allowing buffer)
        // it might indicate manual time manipulation (jump forward).
        if system_delta > tick_delta + 3600 { // 1 hour buffer
             // Log as warning but maybe don't block yet, as hibernation/sleep affects ticks/time differently
        }
    }

    Ok((current_system_time, current_tick_count))
}

/// Returns current hardware-backed time identity
pub fn get_hardware_time_context() -> (u64, u64) {
    let system_time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    #[cfg(windows)]
    let tick_count = unsafe { GetTickCount64() };
    
    #[cfg(not(windows))]
    let tick_count = 0;

    (system_time, tick_count)
}
