export function jsonTextContent(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(
          value,
          (_key, nestedValue: unknown) =>
            typeof nestedValue === "bigint" ? nestedValue.toString() : nestedValue,
          2,
        ),
      },
    ],
  };
}
