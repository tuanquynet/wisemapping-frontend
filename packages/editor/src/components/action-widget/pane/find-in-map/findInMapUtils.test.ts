/*
 *    Copyright [2007-2025] [wisemapping]
 *
 *   Licensed under WiseMapping Public License, Version 1.0 (the "License").
 *   It is basically the Apache License, Version 2.0 (the "License") plus the
 *   "powered by wisemapping" text requirement on every single page;
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the license at
 *
 *       https://github.com/wisemapping/wisemapping-open-source/blob/main/LICENSE.md
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 */
import { collectSearchableNodes, filterSearchableNodes } from './findInMapUtils';
import { INodeModel } from '@wisemapping/mindplot';

const createMockNode = (id: number, text: string | null, children: INodeModel[] = []): INodeModel =>
  ({
    getId: () => id,
    getPlainText: () => text ?? '',
    getChildren: () => children,
  }) as INodeModel;

describe('collectSearchableNodes', () => {
  it('includes the root node itself, not just its children', () => {
    const root = createMockNode(1, 'Central Topic');
    expect(collectSearchableNodes(root)).toEqual([{ id: 1, text: 'Central Topic' }]);
  });

  it('flattens nested children in depth-first order', () => {
    const grandchild = createMockNode(3, 'Grandchild');
    const child1 = createMockNode(2, 'Child One', [grandchild]);
    const child2 = createMockNode(4, 'Child Two');
    const root = createMockNode(1, 'Root', [child1, child2]);

    expect(collectSearchableNodes(root)).toEqual([
      { id: 1, text: 'Root' },
      { id: 2, text: 'Child One' },
      { id: 3, text: 'Grandchild' },
      { id: 4, text: 'Child Two' },
    ]);
  });

  it('skips nodes with no text, such as a topic mid-edit', () => {
    const empty = createMockNode(2, '');
    const untitled = createMockNode(3, null);
    const root = createMockNode(1, 'Root', [empty, untitled]);

    expect(collectSearchableNodes(root)).toEqual([{ id: 1, text: 'Root' }]);
  });
});

describe('filterSearchableNodes', () => {
  const nodes = [
    { id: 1, text: 'AI-driven Development' },
    { id: 2, text: 'Backend services' },
    { id: 3, text: 'Frontend AI Copilot' },
  ];

  it('matches case-insensitively', () => {
    expect(filterSearchableNodes(nodes, 'ai')).toEqual([nodes[0], nodes[2]]);
  });

  it('matches on substrings, not just whole words', () => {
    expect(filterSearchableNodes(nodes, 'end')).toEqual([nodes[1], nodes[2]]);
  });

  it('ignores leading and trailing whitespace in the query', () => {
    expect(filterSearchableNodes(nodes, '  backend  ')).toEqual([nodes[1]]);
  });

  it('returns nothing for a blank query, so the panel starts empty rather than listing everything', () => {
    expect(filterSearchableNodes(nodes, '')).toEqual([]);
    expect(filterSearchableNodes(nodes, '   ')).toEqual([]);
  });

  it('returns nothing when no node matches', () => {
    expect(filterSearchableNodes(nodes, 'zzz-nonexistent')).toEqual([]);
  });
});
