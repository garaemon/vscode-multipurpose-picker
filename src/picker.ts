import * as path from 'path';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { QuickPick, Uri } from 'vscode';
import { MPItem, ItemType } from "./item";
import * as util from 'util';
const exec = util.promisify(require('child_process').exec);

export class MPPicker {
  private picker: QuickPick<MPItem>;


  constructor() {
    this.picker = vscode.window.createQuickPick();
    this.picker.onDidAccept(this.onDidAccept.bind(this));
  }

  getCommandItems() {
    const commandItems = [];
    for (const extension of vscode.extensions.all) {
      const packageJson: any = extension.packageJSON;
      if (!packageJson.hasOwnProperty('contributes')) {
        continue;
      }
      const contributes = packageJson.contributes;
      if (!contributes.hasOwnProperty('commands')) {
        continue;
      }
      const commands = contributes.commands;
      for (const command of commands) {
        if (!command.hasOwnProperty('command')) {
          continue;
        }
        let label = command.command;
        if (command.hasOwnProperty('title')) {
          // Add original description at the end of the label because
          // adding ascii string is easy for non-ascii users to search
          // commands through a picker.
          const title = command.title;
          if (title.hasOwnProperty('value') && title.hasOwnProperty('original')) {
            if (title.value !== title.original) {
              label = `${command.title.value} (${command.title.original})`;
            }
            else {
              label = command.title.value;
            }
          }
        }
        const commandItem = new MPItem(ItemType.Command, label, () => {
          vscode.commands.executeCommand(command.command);
        });
        commandItems.push(commandItem);
      }
    }
    return commandItems;
    // const commands = await vscode.commands.getCommands(true);
    // const commandItems = commands
    //   .map((command: string) => new MPItem("command", command, () => {
    //     vscode.commands.executeCommand(command);
    //   }));
    // return commandItems;
  }

  // This method is inspired by vscode-advanced-open-file.
  getRootDirectory() {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      const folder = vscode.workspace.getWorkspaceFolder(
        editor.document.uri
      );

      if (folder === undefined) {
        const workspaces = vscode.workspace.workspaceFolders;
        if (workspaces !== undefined) {
          // workspaces[0].uri.path should point to a directory. It is supposed to be a root
          // directory of the workspace. We don't need to call `path.dirname` because `path.dirname`
          // returns the parent directory of the workspace.
          return workspaces[0].uri.path;
        }
        else {
          return path.dirname(editor.document.uri.path);
        }
      }
      return folder.uri.path;
    }
    vscode.window.showInformationMessage(`no active editor`);
    return '';
  }

  openFile(filePath: string) {
    vscode.workspace.openTextDocument(Uri.file(filePath)).then((document) => {
      vscode.window.showTextDocument(document);
    });
  }

  async getFileItems() {
    const rootPath = this.getRootDirectory();
    if (!rootPath) {
      return [];
    }
    const rootUri = Uri.file(rootPath);
    const files = await vscode.workspace.fs.readDirectory(rootUri);
    return files.filter((f) => f[1] === vscode.FileType.File)
      .map((f) => {
        const fullPath = path.join(rootPath, f[0]);
        // Show relative path but use absolute path for opening
        return new MPItem(ItemType.File, f[0], () => {
          this.openFile(fullPath);
        });
      });
  }

  getGitRootDirectory(directory: string): string | null {
    if (directory === '/' || directory === '') {
      return null;
    }
    else if (fs.existsSync(path.join(directory, '.git'))) {
      // TODO: check file type and verify .git is directory
      return directory;
    }
    else {
      return this.getGitRootDirectory(path.resolve(path.join(directory, '..')));
    }
  }

  async getGitFiles() {
    const gitRootDirectory = this.getGitRootDirectory(this.getRootDirectory());
    if (gitRootDirectory === null) {
      return [];
    }

    // Run git ls-files to list
    try {
      const { stdout, stderr } = await exec('git ls-files', { 'cwd': gitRootDirectory });
      if (stderr) {
        vscode.window.showErrorMessage(`Failed to run git-ls-files at ${gitRootDirectory}`);
        throw new Error('Failed to run git-ls-files');
      }
      const files = stdout.split('\n');
      return files.map((f: string) => new MPItem(ItemType.Git, f, () => {
        const fullPath = path.join(gitRootDirectory, f);
        this.openFile(fullPath);
      }));
    }
    catch (error) {
      vscode.window.showErrorMessage(`Failed to run git-ls-files at ${gitRootDirectory}: ${error}`);
      throw new Error('Failed to run git-ls-files');
    }
  };

  async getEditorItems() {
    interface UriObject {
      uri: vscode.Uri;
    }
    const items = [];
    let tabIndex: number = 0;
    for (const tabGroup of vscode.window.tabGroups.all) {
      for (const tab of tabGroup.tabs) {
        // tab.input can be undefined?
        if (tab.input === undefined) {
          continue;
        }
        if ((tab.input as object).hasOwnProperty('uri')) {
          const input = tab.input as UriObject;
          items.push(new MPItem(ItemType.Editor, `${tab.label} (Tab ${tabIndex})`, () => {
            vscode.workspace.openTextDocument(input.uri).then((document) => {
              vscode.window.showTextDocument(document);
            });
          }));
        }
      }
      tabIndex = tabIndex + 1;
    }
    return items;
  }

  async updateItems() {
    // Files
    const activeEditors = await this.getEditorItems();
    const fileItems = await this.getFileItems();
    const gitFiles = await this.getGitFiles();
    const commandItems = this.getCommandItems();
    this.picker.items = activeEditors.concat(fileItems).concat(gitFiles).concat(commandItems);
  }

  onDidAccept() {
    const pickedItem = this.picker.selectedItems[0];
    pickedItem.action();
    this.picker.hide();
  }

  show() {
    this.updateItems().then(() => {
      this.picker.show();
    });
  }
}
