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
import { INodeModel } from '@wisemapping/mindplot';

/** A node reduced to what "Find in map" needs: its id and its searchable text. */
export interface SearchableNode {
  id: number;
  text: string;
}

/**
 * Flattens a mindmap's node tree (starting at, and including, the central topic)
 * into a searchable list. Nodes without text (e.g. an empty topic mid-edit) are
 * skipped, matching the behavior of the outline view.
 */
export function collectSearchableNodes(root: INodeModel): SearchableNode[] {
  const result: SearchableNode[] = [];

  const visit = (node: INodeModel): void => {
    const text = node.getPlainText();
    if (text) {
      result.push({ id: node.getId(), text });
    }
    node.getChildren().forEach(visit);
  };

  visit(root);
  return result;
}

/**
 * Case-insensitive substring match, in tree order. Matching order (rather than,
 * say, best-match-first) keeps "next/previous" navigation predictable.
 */
export function filterSearchableNodes(nodes: SearchableNode[], query: string): SearchableNode[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    return [];
  }
  return nodes.filter((node) => node.text.toLowerCase().includes(trimmed));
}
