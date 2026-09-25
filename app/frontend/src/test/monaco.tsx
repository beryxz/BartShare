let suggestWidgetOpen = false;

/** Drives whether the mock renders a stand-in for Monaco's suggest widget.
 *  `monacoOwnsEscape` looks for that element by class name, so this is what
 *  decides whether Escape belongs to the editor or to the sheet. */
export function setSuggestWidgetOpen(open: boolean) {
    suggestWidgetOpen = open;
}

export function BartEditorMock({
    value,
    onChange,
}: {
    value?: string;
    onChange?: (next: string) => void;
}) {
    return (
        <div>
            <textarea
                aria-label="Rule source"
                value={value ?? ''}
                onChange={e => onChange?.(e.target.value)}
            />
            {suggestWidgetOpen && <div className="suggest-widget visible" />}
        </div>
    );
}
