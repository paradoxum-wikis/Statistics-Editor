import {
	deprecatedFn,
	isKnownFn,
	scanDirectives,
	scanDollarRefs,
	scanUnclosedDollars,
	scanVarTags,
} from "./tokens";

export type NeowtextDiagnostic = {
	from: number;
	to: number;
	severity: "error" | "warning" | "info";
	source: "neowtext";
	message: string;
};

function diag(
	from: number,
	to: number,
	message: string,
	severity: NeowtextDiagnostic["severity"] = "error",
): NeowtextDiagnostic {
	return { from, to, severity, source: "neowtext", message };
}

export function lintNeowtext(text: string): NeowtextDiagnostic[] {
	const diagnostics: NeowtextDiagnostic[] = [];

	for (const { from, to } of scanUnclosedDollars(text)) {
		diagnostics.push(diag(from, to, "Unclosed $...$."));
	}

	for (const ref of scanDollarRefs(text)) {
		if (ref.empty) {
			diagnostics.push(diag(ref.from, ref.to, "Empty $...$."));
			continue;
		}
		if (ref.pinError) {
			diagnostics.push(diag(ref.from, ref.to, ref.pinError));
		}
		if (
			(ref.kind === "fnc" || ref.kind === "fse") &&
			!isKnownFn(ref.prefix!, ref.name!)
		) {
			diagnostics.push(
				diag(ref.from, ref.to, `Unknown ${ref.prefix} "${ref.name}".`),
			);
		} else {
			const deprecated = deprecatedFn(ref);
			if (deprecated) {
				diagnostics.push(diag(ref.from, ref.to, deprecated, "warning"));
			}
		}
	}

	let ignoreOpen = -1;
	for (const dir of scanDirectives(text)) {
		if (dir.name === "se-ignore") ignoreOpen = dir.from;
		else if (dir.name === "/se-ignore") {
			if (ignoreOpen < 0) {
				diagnostics.push(
					diag(
						dir.from,
						dir.to,
						"Unexpected @/se-ignore with no open @se-ignore.",
					),
				);
			} else {
				ignoreOpen = -1;
			}
		}
	}
	if (ignoreOpen >= 0) {
		diagnostics.push(
			diag(
				ignoreOpen,
				ignoreOpen + "@se-ignore".length,
				"Unclosed @se-ignore.",
			),
		);
	}

	const tags = scanVarTags(text);
	let depth = 0;
	let lastOpen = -1;
	for (const tag of tags) {
		if (tag.open) {
			depth++;
			lastOpen = tag.from;
		} else if (depth === 0) {
			diagnostics.push(
				diag(tag.from, tag.to, "Unexpected </var> with no open <var>."),
			);
		} else {
			depth--;
		}
	}
	if (depth > 0 && lastOpen >= 0) {
		diagnostics.push(diag(lastOpen, lastOpen + 5, "Unclosed <var> block."));
	}

	return diagnostics;
}
