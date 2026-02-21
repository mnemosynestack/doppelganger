import { Action } from '../../types';

export const ACTION_CATALOG: { type: Action['type']; label: string; description: string }[] = [
    { type: 'click', label: 'Click', description: 'Click an element' },
    { type: 'type', label: 'Type', description: 'Type text into a field' },
    { type: 'hover', label: 'Hover', description: 'Hover an element' },
    { type: 'press', label: 'Press', description: 'Press a key' },
    { type: 'wait', label: 'Wait', description: 'Pause for seconds' },
    { type: 'wait_selector', label: 'Wait for Selector', description: 'Wait until element appears' },
    { type: 'scroll', label: 'Scroll', description: 'Scroll the page or container' },
    { type: 'javascript', label: 'JavaScript', description: 'Run custom JS' },
    { type: 'csv', label: 'CSV', description: 'Parse CSV into rows' },
    { type: 'merge', label: 'Merge', description: 'Merge inputs into a single output' },
    { type: 'screenshot', label: 'Screenshot', description: 'Capture a screenshot' },
    { type: 'navigate', label: 'Navigate To', description: 'Navigate to a URL' },
    { type: 'if', label: 'If', description: 'Conditional block start' },
    { type: 'else', label: 'Else', description: 'Conditional alternate path' },
    { type: 'end', label: 'End Block', description: 'Close a block' },
    { type: 'while', label: 'While', description: 'Loop while condition true' },
    { type: 'repeat', label: 'Repeat N', description: 'Repeat block N times' },
    { type: 'foreach', label: 'For Each', description: 'Loop through items' },
    { type: 'set', label: 'Set Variable', description: 'Update variable value' },
    { type: 'stop', label: 'Stop Task', description: 'Stop task with status' },
    { type: 'on_error', label: 'On Error', description: 'Run on failure' },
    { type: 'start', label: 'Start Task', description: 'Run another task' }
];
