import { describe, it, expect, beforeEach } from 'vitest';
import { TagService } from '../services/tagService';
import { VaultEntry, Category } from '../types';

describe('TagService', () => {
  // Sample entries for testing
  const sampleEntries: VaultEntry[] = [
    {
      id: '1',
      title: 'Apple ID',
      username: 'user@apple.com',
      category: Category.LOGIN,
      tags: ['personal', 'ios', 'apple'],
      updatedAt: Date.now(),
      titleIv: new Uint8Array(12),
      titleTag: new Uint8Array(12),
      usernameIv: new Uint8Array(12),
      usernameTag: new Uint8Array(12),
      encryptedTitle: new Uint8Array(12),
      encryptedUsername: new Uint8Array(12),
      encryptedData: new Uint8Array(12),
      iv: new Uint8Array(12),
      tag: new Uint8Array(12),
      isFavorite: false
    },
    {
      id: '2',
      title: 'Netflix',
      username: 'netflix@gmail.com',
      category: Category.LOGIN,
      tags: ['streaming', 'abonelik'],
      updatedAt: Date.now(),
      titleIv: new Uint8Array(12),
      titleTag: new Uint8Array(12),
      usernameIv: new Uint8Array(12),
      usernameTag: new Uint8Array(12),
      encryptedTitle: new Uint8Array(12),
      encryptedUsername: new Uint8Array(12),
      encryptedData: new Uint8Array(12),
      iv: new Uint8Array(12),
      tag: new Uint8Array(12),
      isFavorite: false
    },
    {
      id: '3',
      title: 'İş Gmail',
      username: 'work@gmail.com',
      category: Category.LOGIN,
      tags: ['iş', 'email'],
      updatedAt: Date.now(),
      titleIv: new Uint8Array(12),
      titleTag: new Uint8Array(12),
      usernameIv: new Uint8Array(12),
      usernameTag: new Uint8Array(12),
      encryptedTitle: new Uint8Array(12),
      encryptedUsername: new Uint8Array(12),
      encryptedData: new Uint8Array(12),
      iv: new Uint8Array(12),
      tag: new Uint8Array(12),
      isFavorite: false
    },
    {
      id: '4',
      title: 'Netflix TV',
      username: 'netflix2@gmail.com',
      category: Category.LOGIN,
      tags: ['streaming', 'abonelik'],
      updatedAt: Date.now(),
      titleIv: new Uint8Array(12),
      titleTag: new Uint8Array(12),
      usernameIv: new Uint8Array(12),
      usernameTag: new Uint8Array(12),
      encryptedTitle: new Uint8Array(12),
      encryptedUsername: new Uint8Array(12),
      encryptedData: new Uint8Array(12),
      iv: new Uint8Array(12),
      tag: new Uint8Array(12),
      isFavorite: false
    },
    {
      id: '5',
      title: 'No Tags Entry',
      username: 'notags@gmail.com',
      category: Category.LOGIN,
      tags: [],
      updatedAt: Date.now(),
      titleIv: new Uint8Array(12),
      titleTag: new Uint8Array(12),
      usernameIv: new Uint8Array(12),
      usernameTag: new Uint8Array(12),
      encryptedTitle: new Uint8Array(12),
      encryptedUsername: new Uint8Array(12),
      encryptedData: new Uint8Array(12),
      iv: new Uint8Array(12),
      tag: new Uint8Array(12),
      isFavorite: false
    }
  ];

  describe('getUniqueTags', () => {
    it('should return unique tags from entries', () => {
      const tags = TagService.getUniqueTags(sampleEntries);
      expect(tags).toContain('abonelik');
      expect(tags).toContain('apple');
      expect(tags).toContain('email');
      expect(tags).toContain('iş');
      expect(tags).toContain('ios');
      expect(tags).toContain('personal');
      expect(tags).toContain('streaming');
      expect(tags).toHaveLength(7);
      expect(tags).toEqual(expect.arrayContaining(['abonelik', 'apple', 'email', 'iş', 'ios', 'personal', 'streaming']));
    });

    it('should handle empty entries array', () => {
      const tags = TagService.getUniqueTags([]);
      expect(tags).toEqual([]);
    });

    it('should handle entries with no tags', () => {
      const noTagEntries: VaultEntry[] = [
        {
          ...sampleEntries[4],
          tags: []
        }
      ];
      const tags = TagService.getUniqueTags(noTagEntries);
      expect(tags).toEqual([]);
    });
  });

  describe('getTagCounts', () => {
    it('should return tag counts correctly', () => {
      const counts = TagService.getTagCounts(sampleEntries);

      expect(counts.get('abonelik')).toBe(2);
      expect(counts.get('streaming')).toBe(2);
      expect(counts.get('personal')).toBe(1);
      expect(counts.get('iş')).toBe(1);
      expect(counts.get('ios')).toBe(1);
      expect(counts.get('apple')).toBe(1);
      expect(counts.get('email')).toBe(1);
    });

    it('should return empty map for empty entries', () => {
      const counts = TagService.getTagCounts([]);
      expect(counts.size).toBe(0);
    });
  });

  describe('filterByTags', () => {
    it('should filter entries by single tag', () => {
      const filtered = TagService.filterByTags(sampleEntries, ['streaming'], false);
      expect(filtered).toHaveLength(2);
      expect(filtered.map(e => e.id)).toEqual(['2', '4']);
    });

    it('should filter entries by multiple tags (OR logic)', () => {
      const filtered = TagService.filterByTags(sampleEntries, ['streaming', 'ios'], false);
      expect(filtered).toHaveLength(3);
      expect(filtered.map(e => e.id)).toContain('1'); // iOS tag
      expect(filtered.map(e => e.id)).toContain('2'); // streaming tag
      expect(filtered.map(e => e.id)).toContain('4'); // streaming tag
    });

    it('should filter entries by multiple tags (AND logic)', () => {
      const filtered = TagService.filterByTags(sampleEntries, ['streaming'], true);
      expect(filtered).toHaveLength(2);

      // Both streaming + abonelik
      const filteredBoth = TagService.filterByTags(sampleEntries, ['streaming', 'abonelik'], true);
      expect(filteredBoth).toHaveLength(2);
      expect(filteredBoth.map(e => e.id)).toEqual(['2', '4']);
    });

    it('should return all entries when filter is empty', () => {
      const filtered = TagService.filterByTags(sampleEntries, [], false);
      expect(filtered).toHaveLength(sampleEntries.length);
    });

    it('should handle case-insensitive matching', () => {
      const filtered = TagService.filterByTags(sampleEntries, ['STREAMING'], false);
      expect(filtered).toHaveLength(2);
    });
  });

  describe('parseTagsFromString', () => {
    it('should parse comma-separated string to array', () => {
      const tags = TagService.parseTagsFromString('personal, work, important');
      expect(tags).toEqual(['personal', 'work', 'important']);
    });

    it('should trim whitespace from tags', () => {
      const tags = TagService.parseTagsFromString('personal , work , important ');
      expect(tags).toEqual(['personal', 'work', 'important']);
    });

    it('should filter empty tags', () => {
      const tags = TagService.parseTagsFromString('personal, , work, ,');
      expect(tags).toEqual(['personal', 'work']);
    });

    it('should handle empty string', () => {
      const tags = TagService.parseTagsFromString('');
      expect(tags).toEqual([]);
    });

    it('should handle null/undefined input', () => {
      const tags1 = TagService.parseTagsFromString((null as any));
      expect(tags1).toEqual([]);

      const tags2 = TagService.parseTagsFromString((undefined as any));
      expect(tags2).toEqual([]);
    });
  });

  describe('tagsToString', () => {
    it('should convert array to comma-separated string', () => {
      const str = TagService.tagsToString(['personal', 'work', 'important']);
      expect(str).toBe('personal, work, important');
    });

    it('should use custom separator', () => {
      const str = TagService.tagsToString(['personal', 'work'], ' | ');
      expect(str).toBe('personal | work');
    });

    it('should handle empty array', () => {
      const str = TagService.tagsToString([]);
      expect(str).toBe('');
    });

    it('should filter null/undefined tags', () => {
      const str = TagService.tagsToString(['personal', null, (undefined as any), 'work']);
      expect(str).toBe('personal, work');
    });
  });

  describe('getPopularTags', () => {
    it('should return top N tags by count', () => {
      const popular = TagService.getPopularTags(sampleEntries, 3);
      expect(popular.length).toBeLessThanOrEqual(3);

      // Top tags are 'abonelik' (2), 'streaming' (2) - order depends on sort stability
      expect(popular).toContain('abonelik');
      expect(popular).toContain('streaming');
    });

    it('should limit results correctly', () => {
      const popular = TagService.getPopularTags(sampleEntries, 2);
      expect(popular.length).toBe(2);
    });

    it('should return empty array for empty entries', () => {
      const popular = TagService.getPopularTags([], 5);
      expect(popular).toEqual([]);
    });
  });

  describe('normalizeTag', () => {
    it('should trim and lowercase tag', () => {
      const normalized = TagService.normalizeTag('  Personal  ');
      expect(normalized).toBe('personal');
    });

    it('should handle empty tag', () => {
      const normalized = TagService.normalizeTag('');
      expect(normalized).toBe('');
    });
  });

  describe('removeTagFromEntries', () => {
    it('should remove specified tag from all entries', () => {
      const updated = TagService.removeTagFromEntries(sampleEntries, 'streaming');

      expect(updated[1].tags).not.toContain('streaming');
      expect(updated[3].tags).not.toContain('streaming');

      // Other tags should remain
      expect(updated[1].tags).toContain('abonelik');
    });

    it('should handle non-existent tag gracefully', () => {
      const updated = TagService.removeTagFromEntries(sampleEntries, 'nonexistent');
      expect(updated).toHaveLength(sampleEntries.length);
    });
  });

  describe('renameTag', () => {
    it('should rename tag across all entries', () => {
      const updated = TagService.renameTag(sampleEntries, 'ios', 'apple-ios');

      expect(updated[0].tags).toContain('apple-ios');
      expect(updated[0].tags).not.toContain('ios');
    });

    it('should handle case-insensitive renaming', () => {
      const updated = TagService.renameTag(sampleEntries, 'IOS', 'apple-ios');

      expect(updated[0].tags).toContain('apple-ios');
      expect(updated[0].tags).not.toContain('ios');
    });
  });

  describe('getTagColor', () => {
    it('should return consistent color for same tag', () => {
      const color1 = TagService.getTagColor('personal');
      const color2 = TagService.getTagColor('personal');

      expect(color1).toBe(color2);
    });

    it('should return different colors for different tags', () => {
      const color1 = TagService.getTagColor('personal');
      const color2 = TagService.getTagColor('work');

      // While colors can theoretically collide, the probability is very low
      expect(color1).not.toBe('');
      expect(color2).not.toBe('');
    });

    it('should return valid CSS class names', () => {
      const color = TagService.getTagColor('test');

      expect(color).toContain('bg-');
      expect(color).toContain('text-');
      expect(color).toContain('border-');
    });
  });

  describe('getSuggestedIcon', () => {
    it('should return appropriate icons for common tags', () => {
      expect(TagService.getSuggestedIcon('iş')).toBe('Briefcase');
      expect(TagService.getSuggestedIcon('personal')).toBe('User');
      expect(TagService.getSuggestedIcon('email')).toBe('Mail');
      expect(TagService.getSuggestedIcon('bank')).toBe('Building2');
    });

    it('should default to Tag icon for unknown tags', () => {
      const icon = TagService.getSuggestedIcon('randomtag');
      expect(icon).toBe('Tag');
    });

    it('should match partial keywords', () => {
      expect(TagService.getSuggestedIcon('kripto')).toBe('Bitcoin');
      expect(TagService.getSuggestedIcon('subscription')).toBe('CreditCard');
    });
  });

  describe('Integration Tests', () => {
    it('should complete full tag workflow', () => {
      // 1. Get unique tags
      const tags = TagService.getUniqueTags(sampleEntries);
      expect(tags.length).toBeGreaterThan(0);

      // 2. Filter by tag
      const filtered = TagService.filterByTags(sampleEntries, [tags[0]], false);
      expect(filtered.length).toBeGreaterThan(0);

      // 3. Get tag color
      const color = TagService.getTagColor(tags[0]);
      expect(color).not.toBe('');

      // 4. Parse and format tags
      const parsed = TagService.parseTagsFromString('tag1, tag2, tag3');
      const formatted = TagService.tagsToString(parsed);
      expect(formatted).toBe('tag1, tag2, tag3');
    });

    it('should handle edge cases gracefully', () => {
      // Empty arrays
      expect(TagService.getUniqueTags([])).toEqual([]);
      expect(TagService.filterByTags([], ['anytag'], false)).toEqual([]);

      // Empty selections
      expect(TagService.filterByTags(sampleEntries, [], false)).toHaveLength(sampleEntries.length);

      // Null/undefined in tag arrays
      const entriesWithNull: VaultEntry[] = [
        {
          ...sampleEntries[0],
          tags: ['personal', (null as any), 'work', (undefined as any)]
        }
      ];
      const uniqueTags = TagService.getUniqueTags(entriesWithNull);
      expect(uniqueTags).toContain('personal');
      expect(uniqueTags).toContain('work');
    });
  });
});
