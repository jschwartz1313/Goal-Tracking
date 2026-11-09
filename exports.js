/* Local-only exports: no journal or gratitude content leaves this browser. */
(function () {
    'use strict';

    const CATEGORY_LABELS = { life: 'Life in general', aislynn: 'Aislynn', recent: 'Something recent' };
    const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
    const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
    let exportState = null;

    function validDate(value) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
        const date = new Date(`${value}T12:00:00`);
        return !Number.isNaN(date.getTime()) &&
            `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` === value;
    }

    function displayDate(value) {
        return validDate(value)
            ? new Date(`${value}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
            : '';
    }

    function dateRangeError(start, end, requireDates = false) {
        if ((requireDates || start || end) && (!start || !end)) return 'Choose both a start date and an end date.';
        if ((start && !validDate(start)) || (end && !validDate(end))) return 'Choose valid dates.';
        if (start && end && start > end) return 'The end date must be on or after the start date.';
        return '';
    }

    function escapeXml(value) {
        return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
    }

    function textBlocks(text, style = 'Normal') {
        return String(text ?? '').replace(/\r\n?/g, '\n').split('\n')
            .map(line => ({ style, runs: [{ text: line }] }));
    }

    // Convert sanitized HTML to a small semantic document model shared by TXT and Word.
    function htmlToBlocks(html) {
        const template = document.createElement('template');
        template.innerHTML = typeof sanitizeJournalHtml === 'function' ? sanitizeJournalHtml(html) : String(html || '');
        const blocks = [];
        let current = null;
        const blockTags = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI']);
        const blockedTags = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE']);
        function flush() {
            if (current && current.runs.length) blocks.push(current);
            current = null;
        }
        function append(text, marks, style) {
            if (!current) current = { style: style || 'Normal', runs: [] };
            current.runs.push({ text, ...marks });
        }
        function walk(node, marks = {}, style = 'Normal') {
            if (node.nodeType === 3) { append(node.textContent || '', marks, style); return; }
            if (node.nodeType !== 1) return;
            const tag = node.tagName;
            if (blockedTags.has(tag)) return;
            if (tag === 'BR') { append('\n', marks, style); return; }
            const nextMarks = { ...marks };
            if (tag === 'B' || tag === 'STRONG') nextMarks.bold = true;
            if (tag === 'I' || tag === 'EM') nextMarks.italic = true;
            if (tag === 'U') nextMarks.underline = true;
            const isBlock = blockTags.has(tag) || tag === 'UL' || tag === 'OL';
            if (isBlock) flush();
            let nextStyle = style;
            if (/^H[1-6]$/.test(tag)) nextStyle = tag === 'H1' || tag === 'H2' ? 'Heading2' : 'Heading3';
            if (tag === 'BLOCKQUOTE') nextStyle = 'Quote';
            if (tag === 'LI') {
                const siblings = Array.from(node.parentElement?.children || []).filter(child => child.tagName === 'LI');
                const marker = node.parentElement?.tagName === 'OL' ? `${siblings.indexOf(node) + 1}. ` : '• ';
                append(marker, nextMarks, nextStyle);
            }
            Array.from(node.childNodes).forEach(child => walk(child, nextMarks, nextStyle));
            if (isBlock) {
                if (!current && !node.textContent?.trim() && tag !== 'UL' && tag !== 'OL') {
                    blocks.push({ style: nextStyle, runs: [{ text: '' }] });
                }
                flush();
            }
        }
        Array.from(template.content.childNodes).forEach(node => walk(node));
        flush();
        return blocks;
    }

    function blockText(block) { return block.runs.map(run => run.text || '').join(''); }
    function hasContent(blocks) { return blocks.some(block => blockText(block).trim()); }

    function readableLabel(value) {
        return String(value || '').replace(/[_-]/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
    }

    function sortRecords(records) {
        return records.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title));
    }

    function collectRecords(type, selection = null, category = 'all') {
        if (type === 'goals') {
            const entries = typeof getAllGoals === 'function' ? getAllGoals() : {};
            return Object.entries(entries).filter(([date]) => validDate(date) && (!selection || date === selection))
                .sort(([a], [b]) => a.localeCompare(b)).map(([date, goals]) => {
                    const blocks = [];
                    (Array.isArray(goals) ? goals : []).forEach(goal => {
                        if (!goal || goal.status === 'deleted' || !String(goal.text || '').trim()) return;
                        blocks.push(...textBlocks(goal.text, 'Heading2'));
                        const status = { incomplete: 'Incomplete', partial: 'Partial', complete: 'Complete', skipped: 'Skipped' }[goal.status];
                        const details = [`Status: ${status || readableLabel(goal.status) || 'Not set'}`];
                        if ([1, 2, 3].includes(Number(goal.priority))) details.push(`Priority: P${goal.priority}`);
                        if (goal.duration !== null && goal.duration !== '' && Number.isFinite(Number(goal.duration))) details.push(`Duration: ${goal.duration} min`);
                        if (goal.category) details.push(`Category: ${typeof getGoalCategoryLabel === 'function' ? getGoalCategoryLabel(goal) : readableLabel(goal.category)}`);
                        if (goal.isRecurring) details.push('Recurring daily');
                        if (goal.stayUntilComplete) details.push('Until done');
                        blocks.push(...textBlocks(details.join(' · ')));
                    });
                    return { date, endDate: date, title: displayDate(date), blocks };
                }).filter(record => hasContent(record.blocks));
        }
        if (type === 'projects') {
            const projects = typeof getLongTermGoals === 'function' ? getLongTermGoals() : [];
            return sortRecords((Array.isArray(projects) ? projects : [])
                .filter(project => project && (!selection || String(project.id) === String(selection.projectId)))
                .map(project => {
                    const date = validDate(project.targetDate) ? project.targetDate : null;
                    const blocks = [];
                    if (project.description) blocks.push(...textBlocks(project.description));
                    if (project.status) blocks.push(...textBlocks(`Status: ${readableLabel(project.status)}`));
                    if (project.progress !== null && project.progress !== '' && Number.isFinite(Number(project.progress))) blocks.push(...textBlocks(`Progress: ${project.progress}%`));
                    if (date) blocks.push(...textBlocks(`Target date: ${displayDate(date)}`));
                    if (Array.isArray(project.subGoals) && project.subGoals.length) {
                        blocks.push(...textBlocks('Sub-goals', 'Heading2'));
                        project.subGoals.forEach(goal => {
                            if (goal && goal.text) blocks.push(...textBlocks(`${goal.completed ? '[Complete]' : '[Open]'} ${goal.text}`));
                        });
                    }
                    return { date, endDate: date, title: project.title || 'Untitled project', blocks };
                }));
        }
        if (type === 'gratitude') {
            const entries = typeof getGratitudeEntries === 'function' ? getGratitudeEntries() : {};
            return Object.entries(entries).filter(([date]) => validDate(date) && (!selection || date === selection))
                .map(([date, entry]) => {
                    const blocks = [];
                    Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
                        if (category !== 'all' && category !== key) return;
                        if (typeof entry[key] !== 'string' || !entry[key].trim()) return;
                        blocks.push(...textBlocks(label, 'Heading2'), ...textBlocks(entry[key]));
                    });
                    return { date, endDate: date, title: displayDate(date), blocks };
                }).filter(record => hasContent(record.blocks)).sort((a, b) => a.date.localeCompare(b.date));
        }
        const daily = typeof getJournalEntries === 'function' ? getJournalEntries() : {};
        const multi = typeof getMultiDayJournalEntries === 'function' ? getMultiDayJournalEntries() : [];
        const records = Object.entries(daily)
            .filter(([date]) => validDate(date) && (!selection || typeof selection === 'string' && date === selection))
            .map(([date, entry]) => ({ date, endDate: date, title: displayDate(date), blocks: htmlToBlocks(entry.content || '') }));
        multi.filter(entry => !selection || typeof selection === 'object' && String(entry.id) === String(selection.multiId))
            .forEach(entry => {
                const start = validDate(entry.startDate) ? entry.startDate : null;
                const end = validDate(entry.endDate) ? entry.endDate : start;
                const date = start || end;
                const label = start && end && start !== end ? `${displayDate(start)} – ${displayDate(end)}` : displayDate(date);
                records.push({
                    date, endDate: end || date, title: entry.title || 'Journal entry',
                    subtitle: label || 'Undated entry', blocks: htmlToBlocks(entry.content || '')
                });
            });
        return sortRecords(records.filter(record => hasContent(record.blocks)));
    }

    function filterRecords(records, start, end, includeUndated = true) {
        return records.filter(record => {
            if (!record.date) return includeUndated;
            return (!start || (record.endDate || record.date) >= start) && (!end || record.date <= end);
        });
    }

    function exportTitle(type, category = 'all') {
        if (type === 'goals') return 'Daily Goals';
        if (type === 'projects') return 'Projects';
        if (type === 'journal') return 'Journal Entries';
        return category === 'all' ? 'Gratitude Entries' : `Gratitude for ${CATEGORY_LABELS[category] || 'Life'}`;
    }

    function readRecords(type, selection, category = 'all') {
        try {
            return { records: collectRecords(type, selection, category) };
        } catch (error) {
            return { records: [], error: `Your saved ${type === 'goals' ? 'daily goals' : type === 'projects' ? 'projects' : `${type} entries`} could not be read. No export was created.` };
        }
    }

    function allBlocks(title, records) {
        const blocks = textBlocks(title, 'Title');
        records.forEach(record => {
            blocks.push(...textBlocks(record.title, 'Heading1'));
            if (record.subtitle) blocks.push(...textBlocks(record.subtitle, 'Subtitle'));
            blocks.push(...record.blocks);
        });
        return blocks;
    }

    function createPlainText(title, records) {
        return allBlocks(title, records).map(block => blockText(block)).join('\n\n') + '\n';
    }

    function runXml(run) {
        const properties = `${run.bold ? '<w:b/>' : ''}${run.italic ? '<w:i/>' : ''}${run.underline ? '<w:u w:val="single"/>' : ''}`;
        const text = String(run.text || '').split('\n').map(part => `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`).join('<w:br/>');
        return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}${text}</w:r>`;
    }

    function documentXml(title, records) {
        const body = allBlocks(title, records).map(block => `<w:p><w:pPr><w:pStyle w:val="${escapeXml(block.style || 'Normal')}"/></w:pPr>${block.runs.map(runXml).join('')}</w:p>`).join('');
        return `${XML_HEADER}<w:document xmlns:w="${WORD_NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;
    }

    function stylesXml() {
        const style = (id, name, size, color, extra = '') => `<w:style w:type="paragraph" w:styleId="${id}"><w:name w:val="${name}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/></w:pPr><w:rPr><w:sz w:val="${size}"/><w:color w:val="${color}"/>${extra}</w:rPr></w:style>`;
        return `${XML_HEADER}<w:styles xmlns:w="${WORD_NS}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/><w:sz w:val="24"/><w:color w:val="333333"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="300" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>${style('Title', 'Title', 48, '764BA2')}${style('Heading1', 'Heading 1', 32, '5A4680', '<w:b/>')}${style('Heading2', 'Heading 2', 26, '5568B0', '<w:b/>')}${style('Heading3', 'Heading 3', 24, '5568B0', '<w:b/>')}${style('Subtitle', 'Subtitle', 22, '666666', '<w:i/>')}<w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/><w:basedOn w:val="Normal"/><w:pPr><w:ind w:left="360"/><w:spacing w:after="160"/></w:pPr><w:rPr><w:i/><w:color w:val="666666"/></w:rPr></w:style></w:styles>`;
    }

    const crcTable = Array.from({ length: 256 }, (_, value) => {
        for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xEDB88320 ^ value >>> 1 : value >>> 1;
        return value >>> 0;
    });
    function crc32(bytes) {
        let crc = 0xFFFFFFFF;
        for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
        return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function zipStored(files) {
        const encoder = new TextEncoder();
        const localParts = [], centralParts = [];
        let offset = 0, centralSize = 0;
        function header(size) { const bytes = new Uint8Array(size); return { bytes, view: new DataView(bytes.buffer) }; }
        Object.entries(files).forEach(([name, content]) => {
            const fileName = encoder.encode(name);
            const data = content instanceof Uint8Array ? content : encoder.encode(content);
            const checksum = crc32(data);
            const local = header(30);
            local.view.setUint32(0, 0x04034B50, true);
            local.view.setUint16(4, 20, true);
            local.view.setUint16(6, 0x0800, true);
            local.view.setUint16(12, 33, true); // January 1, 1980; stable archive output.
            local.view.setUint32(14, checksum, true);
            local.view.setUint32(18, data.length, true);
            local.view.setUint32(22, data.length, true);
            local.view.setUint16(26, fileName.length, true);
            localParts.push(local.bytes, fileName, data);
            const central = header(46);
            central.view.setUint32(0, 0x02014B50, true);
            central.view.setUint16(4, 20, true);
            central.view.setUint16(6, 20, true);
            central.view.setUint16(8, 0x0800, true);
            central.view.setUint16(14, 33, true);
            central.view.setUint32(16, checksum, true);
            central.view.setUint32(20, data.length, true);
            central.view.setUint32(24, data.length, true);
            central.view.setUint16(28, fileName.length, true);
            central.view.setUint32(42, offset, true);
            centralParts.push(central.bytes, fileName);
            centralSize += central.bytes.length + fileName.length;
            offset += local.bytes.length + fileName.length + data.length;
        });
        const end = header(22), count = Object.keys(files).length;
        end.view.setUint32(0, 0x06054B50, true);
        end.view.setUint16(8, count, true);
        end.view.setUint16(10, count, true);
        end.view.setUint32(12, centralSize, true);
        end.view.setUint32(16, offset, true);
        const result = new Uint8Array(offset + centralSize + end.bytes.length);
        let cursor = 0;
        [...localParts, ...centralParts, end.bytes].forEach(part => { result.set(part, cursor); cursor += part.length; });
        return result;
    }

    function createDocx(title, records) {
        const relNS = 'http://schemas.openxmlformats.org/package/2006/relationships';
        return zipStored({
            '[Content_Types].xml': `${XML_HEADER}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
            '_rels/.rels': `${XML_HEADER}<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
            'word/document.xml': documentXml(title, records),
            'word/styles.xml': stylesXml(),
            'word/_rels/document.xml.rels': `${XML_HEADER}<Relationships xmlns="${relNS}"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
        });
    }

    function ensureDialog() {
        let dialog = document.getElementById('exportDialog');
        if (dialog) return dialog;
        dialog = document.createElement('dialog');
        dialog.id = 'exportDialog';
        dialog.className = 'entry-export-dialog';
        dialog.setAttribute('aria-labelledby', 'exportDialogTitle');
        dialog.innerHTML = `<div class="export-dialog-header"><h2 id="exportDialogTitle">Export entries</h2><button type="button" class="export-close" aria-label="Close export dialog">×</button></div>
            <form class="export-dialog-form"><p id="exportDescription">Choose a date range and download your saved entries.</p>
            <div class="export-dialog-grid"><label>From<input id="exportStartDate" type="date"></label><label>Through<input id="exportEndDate" type="date"></label>
            <label id="exportCategoryLabel">Gratitude to include<select id="exportCategory"><option value="all">All three prompts</option><option value="life">Life in general</option><option value="aislynn">Aislynn only</option><option value="recent">Something recent</option></select></label>
            <label>File format<select id="exportFormat"><option value="docx">Word document (.docx)</option><option value="txt">Plain text (.txt)</option></select></label></div>
            <p id="exportPreview" class="export-preview" role="status" aria-live="polite"></p><p id="exportError" class="export-error" role="alert" hidden></p>
            <div class="export-dialog-actions"><button type="button" class="export-cancel">Cancel</button><button type="submit" id="exportDownload" class="save-journal-btn">Download</button></div></form>`;
        dialog.querySelector('.export-close').addEventListener('click', () => dialog.close());
        dialog.querySelector('.export-cancel').addEventListener('click', () => dialog.close());
        dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); downloadExport(); });
        ['exportStartDate', 'exportEndDate', 'exportCategory', 'exportFormat'].forEach(id => {
            dialog.querySelector(`#${id}`).addEventListener('input', updatePreview);
            dialog.querySelector(`#${id}`).addEventListener('change', updatePreview);
        });
        document.body.appendChild(dialog);
        return dialog;
    }

    function currentExport() {
        if (!exportState) return { records: [], error: 'Choose entries to export.' };
        const start = document.getElementById('exportStartDate').value;
        const end = document.getElementById('exportEndDate').value;
        const rangeError = dateRangeError(start, end, !!(exportState.start || exportState.end));
        if (rangeError) return { records: [], error: rangeError };
        const category = document.getElementById('exportCategory').value;
        const loaded = readRecords(exportState.type, exportState.selection, category);
        if (loaded.error) return loaded;
        const all = loaded.records;
        const includeUndated = start === exportState.start && end === exportState.end;
        return { records: filterRecords(all, start, end, includeUndated), category, start, end };
    }

    function updatePreview() {
        const result = currentExport();
        const error = document.getElementById('exportError');
        error.hidden = !result.error;
        error.textContent = result.error || '';
        const count = result.records.length;
        const noun = exportState?.type === 'projects' ? count === 1 ? 'project' : 'projects' : count === 1 ? 'entry' : 'entries';
        const order = exportState?.type === 'projects' ? 'by target date' : 'oldest first';
        document.getElementById('exportPreview').textContent = result.error ? '' :
            `${count} saved ${noun} · ${order}${count ? '' : ' · nothing to export for this selection'}`;
        document.getElementById('exportDownload').disabled = !!result.error || !count;
        return result;
    }

    function downloadExport() {
        const result = updatePreview();
        if (result.error || !result.records.length) return;
        try {
            const title = exportTitle(exportState.type, result.category);
            const format = document.getElementById('exportFormat').value;
            const data = format === 'docx' ? createDocx(title, result.records) : createPlainText(title, result.records);
            const blob = new Blob([data], { type: format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            const categorySuffix = exportState.type === 'gratitude' && result.category !== 'all' ? `-${result.category}` : '';
            const filePrefix = exportState.type === 'projects' ? 'projects' : exportState.type === 'goals' ? 'daily-goals' : `${exportState.type}-entries`;
            anchor.href = url;
            anchor.download = `${filePrefix}${categorySuffix}${result.start ? `-${result.start}` : ''}${result.end && result.end !== result.start ? `-to-${result.end}` : ''}.${format}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            const noun = exportState.type === 'projects' ? result.records.length === 1 ? 'project' : 'projects' : result.records.length === 1 ? 'entry' : 'entries';
            document.getElementById('exportPreview').textContent = `Downloaded ${result.records.length} ${noun}.`;
        } catch (error) {
            const errorNode = document.getElementById('exportError');
            errorNode.hidden = false;
            errorNode.textContent = 'The export could not be created. Please try again.';
            console.error('Entry export failed:', error);
        }
    }

    window.openEntryExport = function (type, selection = null) {
        if (!['journal', 'gratitude', 'goals', 'projects'].includes(type)) return;
        if (typeof flushJournalDrafts === 'function' && !flushJournalDrafts()) return;
        const dialog = ensureDialog();
        const records = readRecords(type, selection).records;
        const dates = records.flatMap(record => [record.date, record.endDate]).filter(validDate).sort();
        const start = dates[0] || '', end = dates[dates.length - 1] || '';
        exportState = { type, selection, start, end };
        document.getElementById('exportDialogTitle').textContent = {
            gratitude: 'Export gratitude entries', journal: 'Export journal entries', goals: 'Export daily goals', projects: 'Export projects'
        }[type];
        document.getElementById('exportDescription').textContent = {
            gratitude: 'Choose a date range and prompts to include. Only saved responses are exported, in date order.',
            journal: 'Choose a date range. Multi-day entries are included when their dates overlap your selection.',
            goals: 'Choose a date range. Your daily goals, statuses, priorities, and estimates export separately from your writing.',
            projects: 'Filter projects by target date. The full default range also includes projects without a target date.'
        }[type];
        document.getElementById('exportStartDate').value = start;
        document.getElementById('exportEndDate').value = end;
        document.getElementById('exportStartDate').required = !!dates.length;
        document.getElementById('exportEndDate').required = !!dates.length;
        document.getElementById('exportCategory').value = 'all';
        document.getElementById('exportCategoryLabel').hidden = type !== 'gratitude';
        document.getElementById('exportFormat').value = 'docx';
        updatePreview();
        if (!dialog.open) dialog.showModal();
    };

    // Pure helpers make the actual package format and filtering independently testable.
    window.JournalExports = Object.freeze({ validDate, dateRangeError, escapeXml, textBlocks, htmlToBlocks, collectRecords, readRecords, exportTitle, filterRecords, createPlainText, documentXml, createDocx, crc32, zipStored });
})();
