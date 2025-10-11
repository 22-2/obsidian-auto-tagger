import { uniqBy } from '../../utils';

describe('uniqBy', () => {
  it('should remove duplicates based on the mapper function', () => {
    const arr = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 1, name: 'c' }];
    const result = uniqBy(arr, item => item.id);
    expect(result).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
  });

  it('should handle an empty array', () => {
    const arr: any[] = [];
    const result = uniqBy(arr, item => item);
    expect(result).toEqual([]);
  });

  it('should return the same array if there are no duplicates', () => {
    const arr = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const result = uniqBy(arr, item => item.id);
    expect(result).toEqual(arr);
  });

  it('should handle an array with all duplicate elements', () => {
    const arr = [{ id: 1 }, { id: 1 }, { id: 1 }];
    const result = uniqBy(arr, item => item.id);
    expect(result).toEqual([{ id: 1 }]);
  });

  it('should work with primitive types', () => {
    const arr = [1, 2, 1, 3, 2];
    const result = uniqBy(arr, item => item);
    expect(result).toEqual([1, 2, 3]);
  });
});
