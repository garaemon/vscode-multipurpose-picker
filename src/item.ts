import { QuickPickItem } from "vscode";

export enum ItemType {
  Git,
  File,
  Command,
  Editor,
}

export class MPItem implements QuickPickItem {
  public label: string;
  private commandType: ItemType;
  action: () => void;

  constructor(commandType: ItemType, label: string, action: () => void) {
    this.commandType = commandType;
    if (commandType === ItemType.File) {
      this.label = `$(file) ${label}`;
    }
    else if (commandType === ItemType.Git) {
      this.label = `$(source-control) ${label}`;
    }
    else if (commandType === ItemType.Command) {
      this.label = `$(terminal) ${label}`;
    }
    else if (commandType === ItemType.Editor) {
      this.label = `$(edit) ${label}`;
    }
    else {
      this.label = label;
    }
    this.action = action;
  }
}
