'use client';

import { FormErrors } from '@/components/states/FormErrors';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStickyFlag } from '@/hooks/use-sticky-flag';
import { errorMessages, stripRulePosition } from '@/lib/api/errors';
import { parseRule, toPolicyRule } from '@/lib/bart/parse';
import { PolicyRule, RuleAst, tryPrintRule } from '@/lib/bart/rule';
import { cn } from '@/lib/utils';
import { Maximize2, Minimize2, X } from 'lucide-react';
import type { editor } from 'monaco-editor';
import { useRef, useState } from 'react';
import { AdvancedRuleEditor } from './AdvancedRuleEditor';
import { SimpleRuleEditor } from './SimpleRuleEditor';

const EMPTY_AST: RuleAst = { resource: {} };

/**
 * Hosts both editors over one rule, the `.bart` text the source of truth.
 *
 * Whether the Simple tab is available is a live property of the current text,
 * so block-shaped Bart typed in Advanced lights it up again. `ast` is held
 * separately because `printRule` throws on the empty resource pattern the
 * Simple editor passes through: `source` follows it only when printable, so an
 * unprintable Simple edit shows the last printable text in Advanced.
 */
export function RuleEditorSheet({
    rule,
    open,
    onOpenChange,
    onSave,
}: {
    rule: PolicyRule | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (rule: PolicyRule) => Promise<void>;
}) {
    const [ast, setAst] = useState<RuleAst>(rule?.ast ?? EMPTY_AST);
    const [source, setSource] = useState(rule?.source ?? '');
    const [errors, setErrors] = useState<string[]>([]);
    const [busy, setBusy] = useState(false);
    const [wide, setWide] = useStickyFlag('bart.ruleSheet.wide', false);
    const [confirming, setConfirming] = useState(false);
    // Whether every attribute editor in the Simple tab holds a parseable
    // value; `SimpleRuleEditor` aggregates the dynamic set into this boolean.
    const [blocksValid, setBlocksValid] = useState(true);

    const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);

    /**
     * Whether Monaco has a popup open that Escape should close, not the sheet.
     *
     * Radix listens for Escape on `document` in the capture phase, so this is
     * the only place the decision can be made. The probe searches the whole
     * sheet because `Tabs.Content` unmounts the inactive tab, leaving one of
     * the two Monaco instances mounted. A renamed Monaco class finds nothing
     * and Escape closes the sheet through the discard confirmation.
     */
    function monacoOwnsEscape(): boolean {
        const content = contentRef.current;
        if (!content) return false;
        return (
            content.querySelector(
                '.suggest-widget.visible, .parameter-hints-widget.visible, .monaco-hover:not(.hidden)',
            ) !== null
        );
    }

    // Comparing `source`, not `ast`: `printRule` canonicalises, so a Simple-tab
    // edit of a non-canonical rule would be saved differently, hence dirty.
    const dirty = source !== (rule?.source ?? '');

    /** The one seam every close path goes through: Escape, the ✕, outside-click. */
    function requestClose(next: boolean) {
        if (next) return onOpenChange(true);
        if (dirty) return setConfirming(true);
        onOpenChange(false);
    }

    // Empty text in a brand-new rule is a blank draft, not an unparseable rule.
    // The exemption ends the moment it holds typed text.
    const isNew = rule === null;
    const isBlankDraft = isNew && source.trim() === '';
    const parsed = isBlankDraft ? null : parseRule(source);
    const blocksAvailable = isBlankDraft || (parsed !== null && parsed.ok);
    const blockedReason = parsed && !parsed.ok ? parsed.reason : null;
    // A position marks a syntax error; without one the rule is valid Bart the
    // blocks cannot hold.
    const blockedIsError =
        parsed !== null && !parsed.ok && parsed.at !== undefined;

    const [tab, setTab] = useState(blocksAvailable ? 'simple' : 'advanced');

    /**
     * Switches tab, forgetting what the block editors reported. Radix unmounts
     * the inactive tab, so those editors die and remount clean; keeping
     * `blocksValid` would strand Save disabled on Advanced, which has no
     * attribute rows, and again on a Simple tab that just repainted itself.
     */
    function changeTab(next: string) {
        setBlocksValid(true);
        setTab(next);
    }

    // No prop-sync effect: `RulesList` remounts this on every open via a `key`,
    // and an effect keyed on `[rule]` would miss a reopen of the same rule.

    /** Simple-tab edits write through to the text whenever they can. */
    function changeAst(next: RuleAst) {
        // The server's verdict described the text as sent, so any edit makes
        // it stale.
        setErrors([]);
        setAst(next);
        // An incomplete draft leaves the text as it was: the preview names the
        // missing term and Save is disabled below.
        const printed = tryPrintRule(next);
        if (printed.ok) setSource(printed.text);
    }

    function changeSource(next: string) {
        setErrors([]);
        setSource(next);
        const result = parseRule(next);
        if (result.ok) setAst(result.ast);
    }

    // In the Simple tab the AST is what is being edited, so it must be
    // printable to save.
    const simpleReady = tab !== 'simple' || tryPrintRule(ast).ok;

    async function save() {
        const printed = tryPrintRule(ast);
        const nextSource =
            tab === 'simple' && printed.ok ? printed.text : source;

        setBusy(true);
        setErrors([]);
        try {
            await onSave(
                toPolicyRule(rule?.id ?? `rule-${Date.now()}`, nextSource),
            );
            onOpenChange(false);
        } catch (error) {
            // The sheet stays open, draft intact. The evaluator's words are kept;
            // its document coordinates go, the banner already placing the error.
            setErrors(errorMessages(error).map(stripRulePosition));
        } finally {
            setBusy(false);
        }
    }

    return (
        <Sheet open={open} onOpenChange={requestClose}>
            <SheetContent
                // Works only because generated `SheetContent` spreads `ref`;
                // changing that silently closes the sheet under a widget.
                ref={contentRef}
                // Both corner controls are rendered below instead: the
                // built-in close is a bare icon in generated code.
                showCloseButton={false}
                // Radix autofocuses the widen button, and a `Tooltip` opens
                // on focus whatever its `delayDuration`. Focus the content.
                onOpenAutoFocus={event => {
                    event.preventDefault();
                    contentRef.current?.focus();
                }}
                onEscapeKeyDown={event => {
                    if (monacoOwnsEscape()) event.preventDefault();
                }}
                className={cn(
                    'w-full overflow-y-auto',
                    // Swapped in place, never re-parented: expanding must not
                    // remount Monaco, or the undo stack goes with it.
                    wide ? 'sm:max-w-5xl' : 'sm:max-w-xl',
                )}
            >
                {/* `contents` so the `Tabs` root generates no box and the
                    header and body stay flex children of `SheetContent`. */}
                <Tabs
                    value={tab}
                    onValueChange={changeTab}
                    className="contents"
                >
                    <SheetHeader className="gap-3 border-b">
                        <div className="flex items-center gap-2">
                            <SheetTitle className="text-lg font-semibold tracking-tight">
                                {rule ? 'Edit rule' : 'New rule'}
                            </SheetTitle>
                            {dirty && (
                                <Badge
                                    variant="outline"
                                    className="border-warn-fg/40 text-warn-fg text-xs"
                                >
                                    Unsaved changes
                                </Badge>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                                {/* Set here, not inherited: the nearest
                                    provider is the sidebar's, at delay 0. */}
                                <Tooltip delayDuration={300}>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon-sm"
                                            aria-label={
                                                wide
                                                    ? 'Narrow the editor'
                                                    : 'Widen the editor'
                                            }
                                            onClick={() => setWide(!wide)}
                                        >
                                            {wide ? (
                                                <Minimize2 />
                                            ) : (
                                                <Maximize2 />
                                            )}
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom">
                                        {wide
                                            ? 'Narrow editor'
                                            : 'Widen editor'}
                                    </TooltipContent>
                                </Tooltip>
                                {/* A `SheetClose`, not an `onClick`: Radix
                                    routes it through `requestClose`. */}
                                <SheetClose asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        aria-label="Close"
                                    >
                                        <X />
                                    </Button>
                                </SheetClose>
                            </div>
                        </div>

                        <TabsList>
                            <TabsTrigger
                                value="simple"
                                disabled={!blocksAvailable}
                            >
                                Simple
                            </TabsTrigger>
                            <TabsTrigger value="advanced">Advanced</TabsTrigger>
                        </TabsList>

                        {/* Next to the tab it explains, not at the far end of
                            the sheet. */}
                        {blockedReason && (
                            <p
                                className={cn(
                                    'text-xs',
                                    blockedIsError
                                        ? 'text-verdict-deny-fg'
                                        : 'text-warn-fg',
                                )}
                            >
                                {blockedReason}
                            </p>
                        )}
                    </SheetHeader>

                    <div className="space-y-4 px-4 pb-4">
                        <TabsContent value="simple">
                            <SimpleRuleEditor
                                ast={ast}
                                onChange={changeAst}
                                onValidityChange={setBlocksValid}
                            />
                        </TabsContent>

                        <TabsContent value="advanced">
                            <AdvancedRuleEditor
                                source={source}
                                onChange={changeSource}
                                onReady={instance => {
                                    editorRef.current = instance;
                                }}
                            />
                        </TabsContent>

                        <FormErrors errors={errors} />

                        {/* Visible text, not a `title`: `buttonVariants`
                            sets `disabled:pointer-events-none`, so a
                            tooltip on the button is unreachable. */}
                        {!blocksValid && (
                            <p className="text-xs text-verdict-deny-fg">
                                Fix the highlighted attribute first
                            </p>
                        )}

                        <Button
                            onClick={save}
                            disabled={busy || !simpleReady || !blocksValid}
                        >
                            {busy ? 'Saving…' : 'Save rule'}
                        </Button>
                    </div>
                </Tabs>
            </SheetContent>

            <AlertDialog open={confirming} onOpenChange={setConfirming}>
                <AlertDialogContent
                    // No `AlertDialogTrigger`: this opens from `requestClose`,
                    // so Radix's refocus default would drop focus to `<body>`.
                    onCloseAutoFocus={event => {
                        event.preventDefault();
                        editorRef.current?.focus();
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>Discard changes?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This rule has edits that have not been saved.
                            Closing now loses them.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep editing</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setConfirming(false);
                                onOpenChange(false);
                            }}
                        >
                            Discard
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Sheet>
    );
}
