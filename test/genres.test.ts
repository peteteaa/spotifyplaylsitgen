import { describe, it, expect } from 'vitest'
import {
  BUCKETS, MISC, normalize, bucketsFor, cleanLastfmTags, pickTopBuckets, bestSlot,
} from '../src/genres'

describe('normalize', () => {
  it('handles punctuation and case', () => {
    expect(normalize('Hip-Hop')).toBe('hip hop')
    expect(normalize('R&B')).toBe('r and b')
    expect(normalize('pov: indie')).toBe('pov indie')
    expect(normalize('lo-fi')).toBe('lo fi')
    expect(normalize('k-pop')).toBe('k pop')
    expect(normalize('  Drum_and/Bass!  ')).toBe('drum and bass')
    expect(normalize('música  latina')).toBe('música latina')
  })
})

describe('bucketsFor', () => {
  it('maps realistic genres', () => {
    expect(bucketsFor(['atl hip hop'])).toContain('Hip-Hop')
    expect(bucketsFor(['bedroom pop'])).toEqual(expect.arrayContaining(['Pop', 'Indie / Alternative']))
    expect(bucketsFor(['pov: indie'])).toContain('Indie / Alternative')
    expect(bucketsFor(['uk drill'])).toContain('Hip-Hop')
    expect(bucketsFor(['reggaeton'])).toContain('Latin')
    expect(bucketsFor(['afrobeats'])).toContain('Reggae / Afrobeats')
    expect(bucketsFor(['video game music'])).toContain('Soundtrack')
    expect(bucketsFor(['modern rock'])).toContain('Rock')
    expect(bucketsFor(['neo soul'])).toContain('R&B')
    expect(bucketsFor(['deep house'])).toContain('Electronic')
    expect(bucketsFor(['classic country'])).toContain('Country')
  })
  it('does not put k-pop in Pop', () => {
    const b = bucketsFor(['k-pop'])
    expect(b).toContain('K-Pop')
    expect(b).not.toContain('Pop')
  })
  it('keeps j-pop under Pop', () => {
    expect(bucketsFor(['j-pop'])).toContain('Pop')
  })
  it('allows multi-match and uses word boundaries', () => {
    expect(bucketsFor(['pop rap'])).toEqual(['Pop', 'Hip-Hop'])
    expect(bucketsFor(['trapeze'])).toEqual([])
  })
  it('returns [] for empty / unknown and orders by BUCKETS', () => {
    expect(bucketsFor([])).toEqual([])
    expect(bucketsFor(['zzz unknown'])).toEqual([])
    const r = bucketsFor(['deep house', 'pop', 'trap'])
    expect(r).toEqual(['Pop', 'Hip-Hop', 'Electronic'])
  })
})

describe('cleanLastfmTags', () => {
  const t = (name: string, count: number | string = 100) => ({ name, count })
  it('drops junk', () => {
    expect(cleanLastfmTags([t('seen live'), t('Favorites'), t('indie')], 'x')).toEqual(['indie'])
  })
  it('applies the count threshold and accepts string counts', () => {
    expect(cleanLastfmTags([t('a', 24), t('b', 25), t('c', '30'), t('d', '10')], 'x')).toEqual(['b', 'c'])
  })
  it('drops artist name tag', () => {
    expect(cleanLastfmTags([t('Taylor Swift'), t('pop')], 'taylor swift')).toEqual(['pop'])
  })
  it('drops decades and years', () => {
    expect(cleanLastfmTags([t('80s'), t('2010s'), t('1999'), t('synthwave')], 'x')).toEqual(['synthwave'])
  })
  it('keeps max 5, lowercased and trimmed', () => {
    const tags = ['A ', 'b', 'c', 'd', 'e', 'f', 'g'].map((n) => t(n))
    expect(cleanLastfmTags(tags, 'x')).toEqual(['a', 'b', 'c', 'd', 'e'])
  })
})

describe('pickTopBuckets', () => {
  it('weights by rank', () => {
    // N=4: Rock 4; Country 3+2 = 5 beats it
    const r = pickTopBuckets([['rock'], ['country'], ['country'], []], 2)
    expect(r).toEqual(['Country', 'Rock'])
  })
  it('breaks ties by BUCKETS order', () => {
    expect(pickTopBuckets([['rock'], ['pop']], 2)).toEqual(['Rock', 'Pop'])
    expect(pickTopBuckets([['rock', 'pop']], 2)).toEqual(['Pop', 'Rock'])
  })
  it('fills from BUCKETS when sparse', () => {
    expect(pickTopBuckets([['metal']])).toEqual(['Metal', 'Pop', 'Hip-Hop', 'R&B', 'Rock', 'Indie / Alternative'])
  })
  it('fills when all empty', () => {
    expect(pickTopBuckets([])).toEqual(BUCKETS.slice(0, 6))
    expect(pickTopBuckets([[], ['unknownthing']])).toEqual(BUCKETS.slice(0, 6))
  })
  it('is always n distinct, never Misc', () => {
    const r = pickTopBuckets([['pop', 'rock', 'metal', 'jazz'], ['trap', 'house', 'salsa', 'country']], 6)
    expect(r).toHaveLength(6)
    expect(new Set(r).size).toBe(6)
    expect(r).not.toContain(MISC)
    expect(pickTopBuckets([], 15)).toHaveLength(15)
  })
})

describe('bestSlot', () => {
  it('returns lowest user index present in track buckets', () => {
    expect(bestSlot(['Rock', 'Pop'], ['Jazz', 'Pop', 'Rock'])).toBe(1)
    expect(bestSlot(['Rock'], ['Rock', 'Pop'])).toBe(0)
  })
  it('returns -1 when none', () => {
    expect(bestSlot(['Metal'], ['Pop', 'Rock'])).toBe(-1)
    expect(bestSlot([], ['Pop'])).toBe(-1)
  })
})

describe('bucketsFor false positives', () => {
  it.each([
    ['rhythm and blues', ['R&B']],
    ['hardcore hip hop', ['Hip-Hop']],
    ['roots reggae', ['Reggae / Afrobeats']],
    ['tropical house', ['Electronic']],
    ['dance pop', ['Pop']],
    ['emo rap', ['Hip-Hop']],
    ['folk metal', ['Metal']],
    ['piano rock', ['Rock']],
    ['romantic', []],
  ])('%s', (genre, expected) => {
    expect(bucketsFor([genre])).toEqual(expected)
  })
})

describe('OVERRIDES', () => {
  it('K-pop acts tagged "pop" go to K-Pop, not Pop', () => {
    expect(bucketsFor(['k-pop', 'kpop', 'korean', 'pop'])).toEqual(['K-Pop'])
    expect(bestSlot(bucketsFor(['k-pop', 'pop']), ['Pop', 'K-Pop', 'R&B'])).toBe(1)
  })
})
