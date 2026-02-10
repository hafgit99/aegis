import * as crypto from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import log from 'electron-log';

export function getHardwareId(): string {
    try {
        let id = '';
        if (process.platform === 'win32') {
            id = execSync('wmic csproduct get uuid').toString().split('\n')[1].trim();
        } else if (process.platform === 'darwin') {
            id = execSync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID').toString().split('"')[3];
        } else {
            // Linux
            if (fs.existsSync('/etc/machine-id')) {
                id = fs.readFileSync('/etc/machine-id', 'utf8').trim();
            } else if (fs.existsSync('/var/lib/dbus/machine-id')) {
                id = fs.readFileSync('/var/lib/dbus/machine-id', 'utf8').trim();
            }
        }

        if (!id || id.length < 5) {
            id = `${os.hostname()}-${os.userInfo().username}`;
        }

        // Return short, readable hash of the hardware ID
        return crypto.createHash('sha256').update(id).digest('hex').substring(0, 16).toUpperCase();
    } catch (error) {
        log.error('[DEVICE-ID] Error getting hardware ID');
        return 'AEGIS-UNKNOWN-ID';
    }
}
