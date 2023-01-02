import * as vscode from 'vscode';
import { MPPicker } from "./picker";

export function activate(context: vscode.ExtensionContext) {
	const disposable = vscode.commands.registerCommand('vscode-multipurpose-picker.openMPPicker', openPicker);
	context.subscriptions.push(disposable);
}

export function deactivate() { }

function openPicker() {
	const picker = new MPPicker();
	picker.show();
}
