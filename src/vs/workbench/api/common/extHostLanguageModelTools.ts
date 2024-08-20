/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from 'vs/base/common/cancellation';
import { IDisposable, toDisposable } from 'vs/base/common/lifecycle';
import { revive } from 'vs/base/common/marshalling';
import { generateUuid } from 'vs/base/common/uuid';
import { IExtensionDescription } from 'vs/platform/extensions/common/extensions';
import { ExtHostLanguageModelToolsShape, IMainContext, MainContext, MainThreadLanguageModelToolsShape } from 'vs/workbench/api/common/extHost.protocol';
import * as typeConvert from 'vs/workbench/api/common/extHostTypeConverters';
import { IChatMessage } from 'vs/workbench/contrib/chat/common/languageModels';
import { IToolData, IToolDelta, IToolInvokationDto, IToolResult } from 'vs/workbench/contrib/chat/common/languageModelToolsService';
import type * as vscode from 'vscode';

export class ExtHostLanguageModelTools implements ExtHostLanguageModelToolsShape {
	/** A map of tools that were registered in this EH */
	private readonly _registeredTools = new Map<string, { extension: IExtensionDescription; tool: vscode.LanguageModelTool }>();
	private readonly _proxy: MainThreadLanguageModelToolsShape;
	private readonly _tokenCountFuncs = new Map</* call ID */string, (text: string | vscode.LanguageModelChatMessage, token?: vscode.CancellationToken) => Thenable<number>>();

	/** A map of all known tools, from other EHs or registered in vscode core */
	private readonly _allTools = new Map<string, IToolData>();

	constructor(mainContext: IMainContext) {
		this._proxy = mainContext.getProxy(MainContext.MainThreadLanguageModelTools);

		this._proxy.$getTools().then(tools => {
			for (const tool of tools) {
				this._allTools.set(tool.id, revive(tool));
			}
		});
	}

	async $countTokensForInvokation(callId: string, input: string | IChatMessage, token: CancellationToken): Promise<number> {
		const fn = this._tokenCountFuncs.get(callId);
		if (!fn) {
			throw new Error(`Tool invokation call ${callId} not found`);
		}

		return await fn(typeof input === 'string' ? input : typeConvert.LanguageModelChatMessage.to(input), token);
	}

	async invokeTool(toolId: string, options: vscode.LanguageModelToolInvokationOptions, token: CancellationToken): Promise<vscode.LanguageModelToolResult> {
		const callId = generateUuid();
		if (options.tokenOptions) {
			this._tokenCountFuncs.set(callId, options.tokenOptions.countTokens);
		}
		try {
			// Making the round trip here because not all tools were necessarily registered in this EH
			const result = await this._proxy.$invokeTool({
				toolId,
				callId,
				parameters: options.parameters,
				tokenBudget: options.tokenOptions?.tokenBudget,
			}, token);
			return typeConvert.LanguageModelToolResult.to(result);
		} finally {
			this._tokenCountFuncs.delete(callId);
		}
	}

	async $acceptToolDelta(delta: IToolDelta): Promise<void> {
		if (delta.added) {
			this._allTools.set(delta.added.id, delta.added);
		}

		if (delta.removed) {
			this._allTools.delete(delta.removed);
		}
	}

	get tools(): vscode.LanguageModelToolDescription[] {
		return Array.from(this._allTools.values())
			.map(tool => typeConvert.LanguageModelToolDescription.to(tool));
	}

	async $invokeTool(dto: IToolInvokationDto, token: CancellationToken): Promise<IToolResult> {
		const item = this._registeredTools.get(dto.toolId);
		if (!item) {
			throw new Error(`Unknown tool ${dto.toolId}`);
		}

		const options: vscode.LanguageModelToolInvokationOptions = { parameters: dto.parameters };
		if (dto.tokenBudget !== undefined) {
			options.tokenOptions = {
				tokenBudget: dto.tokenBudget,
				countTokens: this._tokenCountFuncs.get(dto.callId) || ((value, token = CancellationToken.None) =>
					this._proxy.$countTokensForInvokation(dto.callId, typeof value === 'string' ? value : typeConvert.LanguageModelChatMessage.from(value), token))
			};
		}

		const extensionResult = await item.tool.invoke(options, token);
		return typeConvert.LanguageModelToolResult.from(extensionResult);
	}

	registerTool(extension: IExtensionDescription, name: string, tool: vscode.LanguageModelTool): IDisposable {
		this._registeredTools.set(name, { extension, tool });
		this._proxy.$registerTool(name);

		return toDisposable(() => {
			this._registeredTools.delete(name);
			this._proxy.$unregisterTool(name);
		});
	}
}
