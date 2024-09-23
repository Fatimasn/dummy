/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IReadonlyVSDataTransfer } from '../../../../base/common/dataTransfer.js';
import { HierarchicalKind } from '../../../../base/common/hierarchicalKind.js';
import { IRange } from '../../../../editor/common/core/range.js';
import { DocumentPasteContext, DocumentPasteEditProvider, DocumentPasteEditsSession } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';


export class PasteImageProvider implements DocumentPasteEditProvider {

	public readonly kind = new HierarchicalKind('image');

	public readonly pasteMimeTypes = ['image/*'];

	async provideDocumentPasteEdits(_model: ITextModel, _ranges: readonly IRange[], dataTransfer: IReadonlyVSDataTransfer, context: DocumentPasteContext, token: CancellationToken): Promise<DocumentPasteEditsSession | undefined> {
		// TODO: @justschen setup image data types
		// const entry = dataTransfer.get('image/png') || dataTransfer.get('image/jpeg') || dataTransfer.get('image/gif') || dataTransfer.get('image/webp');
		return;
	}
}
