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

import DesignerModel from '../../src/components/DesignerModel';
import Topic from '../../src/components/Topic';
import { DesignerOptions } from '../../src/components/DesignerOptionsBuilder';

const createTopicStub = (id: number, plainText: string): Topic =>
  ({
    getId: () => id,
    getModel: () => ({
      getPlainText: () => plainText,
    }),
  }) as unknown as Topic;

const buildModel = (topics: Topic[]): DesignerModel => {
  const model = new DesignerModel({ zoom: 1 } as DesignerOptions);
  topics.forEach((topic) => model.addTopic(topic));
  return model;
};

describe('DesignerModel.findTopicsByText', () => {
  it('returns topics whose plain text contains the query, case-insensitively', () => {
    const match = createTopicStub(1, 'Project Roadmap');
    const other = createTopicStub(2, 'Budget');
    const model = buildModel([match, other]);

    const result = model.findTopicsByText('roadmap');

    expect(result).toEqual([match]);
  });

  it('returns an empty array for an empty or whitespace-only query', () => {
    const topic = createTopicStub(1, 'Anything');
    const model = buildModel([topic]);

    expect(model.findTopicsByText('')).toEqual([]);
    expect(model.findTopicsByText('   ')).toEqual([]);
  });

  it('matches every topic sharing the queried substring, preserving topic order', () => {
    const first = createTopicStub(1, 'Sprint Planning');
    const second = createTopicStub(2, 'Sprint Retro');
    const unrelated = createTopicStub(3, 'Budget');
    const model = buildModel([first, second, unrelated]);

    const result = model.findTopicsByText('sprint');

    expect(result).toEqual([first, second]);
  });

  it('returns an empty array when no topic matches', () => {
    const topic = createTopicStub(1, 'Budget');
    const model = buildModel([topic]);

    expect(model.findTopicsByText('nonexistent')).toEqual([]);
  });
});
