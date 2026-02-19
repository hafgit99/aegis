export const cliEn = {
    welcome: 'AEGIS VAULT CLI - Quantum-Safe Access',
    enterPassword: 'Enter Master Password: ',
    sessionClosed: 'Session closed. Memory wiped.',
    vaultNotFound: 'Error: Vault database not found.',
    invalidPassword: 'Error: Invalid master password.',
    help: {
        title: 'Available Commands:',
        list: 'List all entries',
        get: 'Get entry details',
        add: 'Add new login entry',
        search: 'Search entries',
        delete: 'Delete entry',
        totp: 'Generate TOTP code',
        gen: 'Generate random password',
        ssh: 'List/Add SSH keys',
        token: 'Manage API tokens',
        version: 'Show version info',
        help: 'Show this help',
    },
    errors: {
        noQuery: 'Error: Please specify a search query.',
        notFound: 'No entry matching "{query}" found.',
        failedDelete: 'Failed to delete entry.',
    }
};

export const cliTr = {
    welcome: 'AEGIS VAULT CLI - Kuantum Güvenli Erişim',
    enterPassword: 'Ana Şifreyi Girin: ',
    sessionClosed: 'Oturum kapatıldı. Bellek temizlendi.',
    vaultNotFound: 'Hata: Kasa veritabanı bulunamadı.',
    invalidPassword: 'Hata: Geçersiz ana şifre.',
    help: {
        title: 'Kullanılabilir Komutlar:',
        list: 'Tüm girişleri listele',
        get: 'Giriş detaylarını getir',
        add: 'Yeni giriş ekle',
        search: 'Girişlerde ara',
        delete: 'Girişi sil',
        totp: '2FA kodu üret',
        gen: 'Rastgele şifre üret',
        ssh: 'SSH anahtarlarını listele/ekle',
        token: 'API token yönetimi',
        version: 'Versiyon bilgisini göster',
        help: 'Yardımı göster',
    },
    errors: {
        noQuery: 'Hata: Lütfen bir arama ifadesi belirtin.',
        notFound: '"{query}" ile eşleşen giriş bulunamadı.',
        failedDelete: 'Giriş silinemedi.',
    }
};
