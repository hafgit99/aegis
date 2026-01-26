import { VaultEntry } from '../types';

/**
 * TagService - Etiket yönetimi için yardımcı servis
 * Girişlerin etiketlere göre organize edilmesi ve filtrelenmesi sağlar
 */
export class TagService {
  /**
   * Tüm girişlerden benzersiz etiket listesini çıkar
   * @param entries - Tüz girişler listesi
   * @returns Sıralı benzersiz etiket dizisi
   */
  static getUniqueTags(entries: VaultEntry[]): string[] {
    const tagSet = new Set<string>();

    entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => {
          if (tag && tag.trim()) {
            tagSet.add(tag.trim());
          }
        });
      }
    });

    return Array.from(tagSet).sort();
  }

  /**
   * Etiket kullanım sayılarını hesapla
   * @param entries - Tüm girişler listesi
   * @returns Etiket ve kullanım sayısı haritası
   */
  static getTagCounts(entries: VaultEntry[]): Map<string, number> {
    const counts = new Map<string, number>();

    entries.forEach(entry => {
      if (entry.tags && Array.isArray(entry.tags)) {
        entry.tags.forEach(tag => {
          if (tag && tag.trim()) {
            const normalizedTag = tag.trim();
            counts.set(normalizedTag, (counts.get(normalizedTag) || 0) + 1);
          }
        });
      }
    });

    return counts;
  }

  /**
   * Belirli etiket(ler)e sahip girişleri filtrele
   * @param entries - Tüm girişler listesi
   * @param filterTags - Filtrelenecek etiketler dizisi
   * @param matchAll - true ise TÜM etiketlere sahip, false ise en az bir etikete sahip girişleri döndür
   * @returns Filtrelenmiş girişler listesi
   */
  static filterByTags(
    entries: VaultEntry[],
    filterTags: string[],
    matchAll: boolean = false
  ): VaultEntry[] {
    if (!filterTags || filterTags.length === 0) {
      return entries;
    }

    const normalizedFilterTags = filterTags
      .map(t => t.trim().toLowerCase())
      .filter(t => t.length > 0);

    return entries.filter(entry => {
      if (!entry.tags || !Array.isArray(entry.tags) || entry.tags.length === 0) {
        return false;
      }

      const normalizedEntryTags = entry.tags
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      if (matchAll) {
        // Tüm filtre etiketleri mevcut olmalı
        return normalizedFilterTags.every(filterTag =>
          normalizedEntryTags.some(entryTag =>
            entryTag.includes(filterTag) || filterTag.includes(entryTag)
          )
        );
      } else {
        // En az bir filtre etiketi mevcut olmalı
        return normalizedFilterTags.some(filterTag =>
          normalizedEntryTags.some(entryTag =>
            entryTag.includes(filterTag) || filterTag.includes(entryTag)
          )
        );
      }
    });
  }

  /**
   * Etiketleri normalize et (küçük harf, boşlukları temizle)
   * @param tag - Etiket
   * @returns Normalize edilmiş etiket
   */
  static normalizeTag(tag: string): string {
    return tag.trim().toLowerCase();
  }

  /**
   * Virgülle ayrılmış etiket string'ini diziye dönüştür
   * @param tagsString - Virgülle ayrılmış etiketler
   * @returns Temizlenmiş etiket dizisi
   */
  static parseTagsFromString(tagsString: string): string[] {
    if (!tagsString || !tagsString.trim()) {
      return [];
    }

    return tagsString
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);
  }

  /**
   * Etiket dizisini string'e dönüştür
   * @param tags - Etiket dizisi
   * @param separator - Ayırıcı (varsayılan: ', ')
   * @returns Birleştirilmiş string
   */
  static tagsToString(tags: string[], separator: string = ', '): string {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      return '';
    }

    return tags
      .filter(tag => tag && tag.trim().length > 0)
      .join(separator);
  }

  /**
   * Popüler etiketleri getir (en çok kullanılanlar)
   * @param entries - Tüm girişler listesi
   * @param limit - Dönecek etiket sayısı
   * @returns Sıralı popüler etiketler dizisi
   */
  static getPopularTags(entries: VaultEntry[], limit: number = 10): string[] {
    const counts = this.getTagCounts(entries);

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1]) // Kullanım sayısına göre azalan sırala
      .slice(0, limit)
      .map(([tag]) => tag);
  }

  /**
   * Bir etiketi tüm girişlerden kaldır
   * @param entries - Tüm girişler listesi
   * @param tagToRemove - Kaldırılacak etiket
   * @returns Güncellenmiş girişler listesi
   */
  static removeTagFromEntries(entries: VaultEntry[], tagToRemove: string): VaultEntry[] {
    const normalizedTag = tagToRemove.trim().toLowerCase();

    return entries.map(entry => {
      if (!entry.tags || !Array.isArray(entry.tags)) {
        return entry;
      }

      return {
        ...entry,
        tags: entry.tags.filter(tag =>
          tag.trim().toLowerCase() !== normalizedTag
        )
      };
    });
  }

  /**
   * Bir etiketi başka bir etiketle yeniden adlandır
   * @param entries - Tüm girişler listesi
   * @param oldTag - Eski etiket
   * @param newTag - Yeni etiket
   * @returns Güncellenmiş girişler listesi
   */
  static renameTag(entries: VaultEntry[], oldTag: string, newTag: string): VaultEntry[] {
    const normalizedOldTag = oldTag.trim().toLowerCase();
    const trimmedNewTag = newTag.trim();

    if (!trimmedNewTag) {
      return entries;
    }

    return entries.map(entry => {
      if (!entry.tags || !Array.isArray(entry.tags)) {
        return entry;
      }

      return {
        ...entry,
        tags: entry.tags.map(tag =>
          tag.trim().toLowerCase() === normalizedOldTag ? trimmedNewTag : tag
        )
      };
    });
  }

  /**
   * Etiket rengi oluştur (hash tabanlı, tutarlı renkler)
   * @param tag - Etiket
   * @returns Renk sınıfı adı
   */
  static getTagColor(tag: string): string {
    const colors = [
      'bg-blue-500/20 text-blue-500 border-blue-500/30',
      'bg-purple-500/20 text-purple-500 border-purple-500/30',
      'bg-pink-500/20 text-pink-500 border-pink-500/30',
      'bg-red-500/20 text-red-500 border-red-500/30',
      'bg-orange-500/20 text-orange-500 border-orange-500/30',
      'bg-amber-500/20 text-amber-500 border-amber-500/30',
      'bg-emerald-500/20 text-emerald-500 border-emerald-500/30',
      'bg-green-500/20 text-green-500 border-green-500/30',
      'bg-teal-500/20 text-teal-500 border-teal-500/30',
      'bg-cyan-500/20 text-cyan-500 border-cyan-500/30',
      'bg-indigo-500/20 text-indigo-500 border-indigo-500/30',
      'bg-violet-500/20 text-violet-500 border-violet-500/30'
    ];

    // Etiket hash'ini hesapla
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
      const char = tag.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32-bit integer'a çevir
    }

    // Pozitif indeks al
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Etiket için ikon seçimi (etiket adına göre öneri)
   * @param tag - Etiket
   * @returns İkon adı (lucide-react)
   */
  static getSuggestedIcon(tag: string): string {
    const normalizedTag = tag.toLowerCase();

    const iconMap: Record<string, string> = {
      'iş': 'Briefcase',
      'is': 'Briefcase',
      'work': 'Briefcase',
      'kişisel': 'User',
      'kisisel': 'User',
      'personal': 'User',
      'sosyal': 'Users',
      'social': 'Users',
      'email': 'Mail',
      'eposta': 'Mail',
      'bank': 'Building2',
      'finans': 'DollarSign',
      'finance': 'DollarSign',
      'kripto': 'Bitcoin',
      'crypto': 'Bitcoin',
      'alışveriş': 'ShoppingCart',
      'shopping': 'ShoppingCart',
      'oyun': 'Gamepad2',
      'game': 'Gamepad2',
      'streaming': 'PlayCircle',
      'abonelik': 'CreditCard',
      'subscription': 'CreditCard',
      'geliştirme': 'Code2',
      'development': 'Code2',
      'sunucu': 'Server',
      'server': 'Server',
      'wifi': 'Wifi',
      'ağ': 'Network',
      'network': 'Network',
      'ev': 'Home',
      'home': 'Home'
    };

    // Tam eşleşme ara
    for (const [key, icon] of Object.entries(iconMap)) {
      if (normalizedTag.includes(key)) {
        return icon;
      }
    }

    return 'Tag';
  }
}
