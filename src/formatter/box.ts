import boxen, { type Options as BoxenOptions } from "boxen";

export interface RenderBoxOptions {
  title?: string;
  noColor?: boolean;
  borderColor?: BoxenOptions["borderColor"];
}

export function renderBox(content: string, options: RenderBoxOptions = {}): string {
  const boxOptions: BoxenOptions = {
    padding: { top: 0, right: 1, bottom: 0, left: 1 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    borderStyle: "round",
    title: options.title,
    ...(!options.noColor && options.borderColor
      ? { borderColor: options.borderColor }
      : {}),
  };

  return boxen(content, boxOptions);
}
