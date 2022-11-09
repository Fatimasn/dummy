/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'vs/base/browser/ui/codicons/codiconStyles'; // The codicon symbol styles are defined here and must be loaded
import { Codicon } from 'vs/base/common/codicons';
import { ActionItemRenderer, ActionList, ActionListItemKind, ListMenuItem } from 'vs/platform/actionWidget/browser/actionWidget';
import { acceptSelectedCodeActionCommand, previewSelectedCodeActionCommand } from 'vs/editor/contrib/codeAction/browser/codeAction';
import { CodeActionItem, CodeActionKind } from 'vs/editor/contrib/codeAction/common/types';
import 'vs/editor/contrib/symbolIcons/browser/symbolIcons'; // The codicon symbol colors are defined here and must be loaded to get colors
import { localize } from 'vs/nls';
import { IContextViewService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { CodeActionKeybindingResolver } from './codeActionKeybindingResolver';

export interface ActionGroup {
	readonly kind: CodeActionKind;
	readonly title: string;
	readonly icon?: { readonly codicon: Codicon; readonly color?: string };
}

const uncategorizedCodeActionGroup = Object.freeze<ActionGroup>({ kind: CodeActionKind.Empty, title: localize('codeAction.widget.id.more', 'More Actions...') });

const codeActionGroups = Object.freeze<ActionGroup[]>([
	{ kind: CodeActionKind.QuickFix, title: localize('codeAction.widget.id.quickfix', 'Quick Fix...') },
	{ kind: CodeActionKind.RefactorExtract, title: localize('codeAction.widget.id.extract', 'Extract...'), icon: { codicon: Codicon.wrench } },
	{ kind: CodeActionKind.RefactorInline, title: localize('codeAction.widget.id.inline', 'Inline...'), icon: { codicon: Codicon.wrench } },
	{ kind: CodeActionKind.RefactorRewrite, title: localize('codeAction.widget.id.convert', 'Rewrite...'), icon: { codicon: Codicon.wrench } },
	{ kind: CodeActionKind.RefactorMove, title: localize('codeAction.widget.id.move', 'Move...'), icon: { codicon: Codicon.wrench } },
	{ kind: CodeActionKind.SurroundWith, title: localize('codeAction.widget.id.surround', 'Surround With...'), icon: { codicon: Codicon.symbolSnippet } },
	{ kind: CodeActionKind.Source, title: localize('codeAction.widget.id.source', 'Source Action...'), icon: { codicon: Codicon.symbolFile } },
	uncategorizedCodeActionGroup,
]);

export class CodeActionList extends ActionList<CodeActionItem> {

	constructor(
		codeActions: readonly CodeActionItem[],
		showHeaders: boolean,
		onDidSelect: (action: CodeActionItem, preview?: boolean) => void,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextViewService contextViewService: IContextViewService
	) {
		super('codeActionWidget',
			[new ActionItemRenderer(previewSelectedCodeActionCommand, acceptSelectedCodeActionCommand, keybindingService, new CodeActionKeybindingResolver(keybindingService))],
			codeActions, showHeaders, previewSelectedCodeActionCommand, acceptSelectedCodeActionCommand, onDidSelect, contextViewService);
	}

	public toMenuItems(inputCodeActions: readonly CodeActionItem[], showHeaders: boolean): ListMenuItem<CodeActionItem>[] {
		if (!showHeaders) {
			return inputCodeActions.map((action): ListMenuItem<CodeActionItem> => {
				return {
					kind: ActionListItemKind.Action,
					item: action,
					group: uncategorizedCodeActionGroup,
					disabled: !!action.action.disabled,
					label: action.action.title
				};
			});
		}

		// Group code actions
		const menuEntries = codeActionGroups.map(group => ({ group, actions: [] as CodeActionItem[] }));

		for (const action of inputCodeActions) {
			const kind = action.action.kind ? new CodeActionKind(action.action.kind) : CodeActionKind.None;
			for (const menuEntry of menuEntries) {
				if (menuEntry.group.kind.contains(kind)) {
					menuEntry.actions.push(action);
					break;
				}
			}
		}

		const allMenuItems: ListMenuItem<CodeActionItem>[] = [];
		for (const menuEntry of menuEntries) {
			if (menuEntry.actions.length) {
				allMenuItems.push({ kind: ActionListItemKind.Header, group: menuEntry.group });
				for (const action of menuEntry.actions) {
					allMenuItems.push({ kind: ActionListItemKind.Action, item: action, group: menuEntry.group, label: action.action.title, disabled: action.action.disabled });
				}
			}
		}
		return allMenuItems;
	}
}
