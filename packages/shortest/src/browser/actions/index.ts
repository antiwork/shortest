import { Page } from "playwright";
import { ToolError } from "@/utils/errors";

export const keyboardShortcuts: Record<string, string | string[]> = {
  "ctrl+l": ["Control", "l"],
  "ctrl+a": ["Control", "a"],
  "ctrl+c": ["Control", "c"],
  "ctrl+v": ["Control", "v"],
  "alt+tab": ["Alt", "Tab"],
  return: ["Enter"],
  enter: ["Enter"],
  esc: ["Escape"],
  tab: ["Tab"],
  delete: ["Delete"],
  backspace: ["Backspace"],
  space: [" "],
  arrowup: ["ArrowUp"],
  arrowdown: ["ArrowDown"],
  arrowleft: ["ArrowLeft"],
  arrowright: ["ArrowRight"],
  page_down: ["PageDown"],
  page_up: ["PageUp"],
};

export const scaleRatio = {
  x: 1543 / 1170,
  y: 32 / 24,
};

export const mouseMove = async (
  page: Page,
  x: number,
  y: number,
): Promise<void> => {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    throw new ToolError("Coordinates must be non-negative integers");
  }

  const scaledX = Math.round(x * scaleRatio.x);
  const scaledY = Math.round(y * scaleRatio.y);

  await page.mouse.move(scaledX, scaledY);

  // Update visual cursor
  await page.evaluate(
    ({ x, y }) => {
      const cursor = document.getElementById("ai-cursor");
      const trail = document.getElementById("ai-cursor-trail");
      if (cursor && trail) {
        window.cursorPosition = { x, y };
        cursor.style.left = `${x}px`;
        cursor.style.top = `${y}px`;

        setTimeout(() => {
          trail.style.left = `${x}px`;
          trail.style.top = `${y}px`;
        }, 50);
      }
    },
    { x: scaledX, y: scaledY },
  );

  await page.waitForTimeout(50);
};

export const click = async (
  page: Page,
  x: number,
  y: number,
  options: { button?: "left" | "right" | "middle"; clickCount?: number } = {
    button: "left",
    clickCount: 1,
  },
): Promise<void> => {
  const scaledX = Math.round(x * scaleRatio.x);
  const scaledY = Math.round(y * scaleRatio.y);

  await mouseMove(page, x, y);
  const animationPromise = showClickAnimation(page, "left");

  await Promise.all([
    page.mouse.click(scaledX, scaledY, options),
    animationPromise,
  ]);
};

export const dragMouse = async (
  page: Page,
  x: number,
  y: number,
): Promise<void> => {
  const scaledX = Math.round(x * scaleRatio.x);
  const scaledY = Math.round(y * scaleRatio.y);

  await page.mouse.down();
  await page.mouse.move(scaledX, scaledY);
  await page.mouse.up();
};

export const showClickAnimation = async (
  page: Page,
  type: "left" | "right" | "double" = "left",
) =>
  await page.evaluate(
    (clickType) =>
      new Promise<void>((resolve) => {
        const cursor = document.getElementById("ai-cursor");
        if (!cursor) return resolve(undefined);

        cursor.classList.add("clicking");
        switch (clickType) {
          case "double":
            cursor.style.transform = "translate(-50%, -50%) scale(0.7)";
            cursor.style.backgroundColor = "rgba(255, 0, 0, 0.5)";
            break;
          case "right":
            cursor.style.borderColor = "blue";
            break;
          default:
            cursor.style.transform = "translate(-50%, -50%) scale(0.8)";
        }

        setTimeout(() => {
          cursor.classList.remove("clicking");
          cursor.style.transform = "translate(-50%, -50%) scale(1)";
          cursor.style.backgroundColor = "rgba(255, 0, 0, 0.2)";
          cursor.style.borderColor = "red";
          resolve(undefined);
        }, 200);
      }),
    type,
  );

export const getCursorPosition = async (
  page: Page,
): Promise<[number, number]> => {
  const position = await page.evaluate(
    () => window.cursorPosition || { x: 0, y: 0 },
  );
  return [position.x, position.y];
};
