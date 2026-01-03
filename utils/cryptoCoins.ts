// Crypto coin metadata for payment system
export interface CryptoCoin {
    id: string;
    name: string;
    network: string;
    address: string;
    icon: string;
    color: string;
}

export const CRYPTO_COINS: CryptoCoin[] = [
    {
        id: 'BTC',
        name: 'Bitcoin',
        network: 'Native SegWit',
        address: 'bc1qqsuljwzs32ckkqdrsdus7wgqzuetty3g0x47l7',
        icon: '₿',
        color: '#F7931A'
    },
    {
        id: 'TRX',
        name: 'Tron',
        network: 'TRC20 (USDT, TRX)',
        address: 'TQBz3q8Ddjap3K8QdFQHtJKBxbvXMCi62E',
        icon: 'T',
        color: '#EB0029'
    },
    {
        id: 'ETH',
        name: 'Ethereum',
        network: 'ERC20',
        address: '0x4bd17Cc073D08E3E021Fd315d840554c840843E1',
        icon: 'Ξ',
        color: '#627EEA'
    },
    {
        id: 'SOL',
        name: 'Solana',
        network: 'SPL Token',
        address: '81H1rKZHjpSsnr6Epumw9XVTfqAnqSHcTKm7D3VsEd74',
        icon: 'S',
        color: '#14F195'
    },
    {
        id: 'LTC',
        name: 'Litecoin',
        network: 'Native',
        address: 'LZC3egqj1K9aZ3i42HbsRWK7m1SbUgXmak',
        icon: 'Ł',
        color: '#345D9D'
    },
    {
        id: 'BCH',
        name: 'Bitcoin Cash',
        network: 'CashAddr',
        address: 'qzfd46kp4tguu8pxrs6gnux0qxndhnqk8sa83q08wm',
        icon: 'BCH',
        color: '#8DC351'
    },
    {
        id: 'XTZ',
        name: 'Tezos',
        network: 'Native',
        address: 'tz1Tij1ujzkEyvA949x1q7EW17s6pUNbEUdV',
        icon: 'XTZ',
        color: '#2C7DF7'
    }
];

export const PAYMENT_EMAIL = 'sales@hetech-me.space';
export const PAYMENT_PRICE_EUR = 15;
