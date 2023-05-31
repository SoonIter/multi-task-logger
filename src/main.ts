import { EOL } from 'node:os';
import readline from 'node:readline';
import cliCursor from 'cli-cursor';
import { dots } from 'cli-spinners';
import chalk from 'chalk';
import { isCI } from './utils'

class CLIOutput {
  readonly X_PADDING = ' ';
  cliName = 'NX';
  formatCommand = (taskId: string) => `${chalk.dim('nx run')} ${taskId}`;

  /**
   * Longer dash character which forms more of a continuous line when place side to side
   * with itself, unlike the standard dash character
   */
  private get VERTICAL_SEPARATOR() {
    let divider = '';
    for (
      let i = 0;
      i < process.stdout.columns - this.X_PADDING.length * 2;
      i++
    )
      divider += '\u2014';

    return divider;
  }

  /**
   * Expose some color and other utility functions so that other parts of the codebase that need
   * more fine-grained control of message bodies are still using a centralized
   * implementation.
   */
  colors = {
    gray: chalk.gray,
    green: chalk.green,
    red: chalk.red,
    cyan: chalk.cyan,
    white: chalk.white,
  };

  bold = chalk.bold;
  underline = chalk.underline;
  dim = chalk.dim;

  private writeToStdOut(str: string) {
    process.stdout.write(str);
  }

  private writeOutputTitle({
    color,
    title,
  }: {
    color: string
    title: string
  }): void {
    this.writeToStdOut(` ${this.applyNxPrefix(color, title)}${EOL}`);
  }

  private writeOptionalOutputBody(bodyLines?: string[]): void {
    if (!bodyLines)
      return;

    this.addNewline();
    bodyLines.forEach(bodyLine => this.writeToStdOut(`   ${bodyLine}${EOL}`));
  }

  applyNxPrefix(color = 'cyan', text: string): string {
    let nxPrefix = '';
    if (chalk[color]) {
      nxPrefix = `${chalk[color]('>')} ${chalk.reset.inverse.bold[color](
        ` ${this.cliName} `,
      )}`;
    }
    else {
      nxPrefix = `${chalk[color](
        '>',
      )} ${chalk.reset.inverse.bold[color](` ${this.cliName} `)}`;
    }
    return `${nxPrefix}  ${text}`;
  }

  addNewline() {
    this.writeToStdOut(EOL);
  }

  addVerticalSeparator(color = 'gray') {
    this.addNewline();
    this.addVerticalSeparatorWithoutNewLines(color);
    this.addNewline();
  }

  addVerticalSeparatorWithoutNewLines(color = 'gray') {
    this.writeToStdOut(
      `${this.X_PADDING}${chalk.dim[color](this.VERTICAL_SEPARATOR)}${EOL}`,
    );
  }

  error({ title, slug, bodyLines }: CLIErrorMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'red',
      title: chalk.red(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  warn({ title, slug, bodyLines }: CLIWarnMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'yellow',
      title: chalk.yellow(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  note({ title, bodyLines }: CLINoteMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'orange',
      title: chalk.keyword('orange')(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  success({ title, bodyLines }: CLISuccessMessageConfig) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'green',
      title: chalk.green(title),
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  logSingleLine(message: string) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'gray',
      title: message,
    });

    this.addNewline();
  }

  logCommand(message: string, taskStatus?: any) {
    this.addNewline();
    const commandOutput
      = chalk.dim('> ') + this.formatCommand(this.normalizeMessage(message));
    const commandOutputWithStatus = this.addTaskStatus(
      taskStatus,
      commandOutput,
    );
    this.writeToStdOut(commandOutputWithStatus);
    this.addNewline();
  }

  private normalizeMessage(message: string) {
    if (message.startsWith('nx run '))
      return message.substring('nx run '.length);
    else if (message.startsWith('run '))
      return message.substring('run '.length);
    else
      return message;
  }

  private addTaskStatus(
    taskStatus:
    | 'success'
    | 'failure'
    | 'skipped'
    | 'local-cache-kept-existing'
    | 'local-cache'
    | 'remote-cache',
    commandOutput: string,
  ) {
    if (taskStatus === 'local-cache') {
      return `${commandOutput}  ${chalk.dim('[local cache]')}`;
    }
    else if (taskStatus === 'remote-cache') {
      return `${commandOutput}  ${chalk.dim('[remote cache]')}`;
    }
    else if (taskStatus === 'local-cache-kept-existing') {
      return `${commandOutput}  ${chalk.dim(
        '[existing outputs match the cache, left as is]',
      )}`;
    }
    else {
      return commandOutput;
    }
  }

  log({ title, bodyLines, color }: CLIWarnMessageConfig & { color?: string }) {
    this.addNewline();

    this.writeOutputTitle({
      color: 'cyan',
      title: color ? chalk[color](title) : title,
    });

    this.writeOptionalOutputBody(bodyLines);

    this.addNewline();
  }

  drain(): Promise<void> {
    return new Promise((resolve) => {
      if (process.stdout.writableNeedDrain)
        process.stdout.once('drain', resolve);
      else
        resolve();
    });
  }
}

const nano = (time: [number, number]) => +time[0] * 1e9 + +time[1];

const scale = {
  w: 6048e11,
  d: 864e11,
  h: 36e11,
  m: 6e10,
  s: 1e9,
  ms: 1e6,
  μs: 1e3,
  ns: 1,
};

const regex = {
  w: /^(w((ee)?k)?s?)$/,
  d: /^(d(ay)?s?)$/,
  h: /^(h((ou)?r)?s?)$/,
  m: /^(min(ute)?s?|m)$/,
  s: /^((sec(ond)?)s?|s)$/,
  ms: /^(milli(second)?s?|ms)$/,
  μs: /^(micro(second)?s?|μs)$/,
  ns: /^(nano(second)?s?|ns?)$/,
};

const isSmallest = function (uom: keyof typeof scale, unit: string) {
  return regex[uom].test(unit);
};

const round = function (num: number, digits) {
  const n = Math.abs(num);
  return /[0-9]/.test(digits) ? Number(n.toFixed(digits)) : Math.round(n);
};

export function prettyTime(time: number | [number, number], smallest?, digits?) {
  const isNumber = /^[0-9]+$/.test(time.toString());
  if (!isNumber && !Array.isArray(time))
    throw new TypeError('expected an array or number in nanoseconds');

  if (Array.isArray(time) && time.length !== 2)
    throw new TypeError('expected an array from process.hrtime()');

  if (/^[0-9]+$/.test(smallest)) {
    digits = smallest;
    smallest = null;
  }

  let num = isNumber ? time as number : nano(time as [number, number]);
  let res = '';
  let prev: number | null = null;

  for (const uom of Object.keys(scale)) {
    const step = scale[uom];
    let inc = num / step;

    if (smallest && isSmallest(uom as keyof typeof scale, smallest)) {
      inc = round(inc, digits);
      if (prev && inc === prev / step)
        --inc;
      res += inc + uom;
      return res.trim();
    }

    if (inc < 1)
      continue;
    if (!smallest) {
      inc = round(inc, digits);
      res += inc + uom;
      return res;
    }

    prev = step;

    inc = Math.floor(inc);
    num -= inc * step;
    res += `${inc + uom} `;
  }

  return res.trim();
}

const VIEW_LOGS_MESSAGE = 'Hint: Try "nx view-logs" to get structured, searchable errors logs in your browser.';
const output = new CLIOutput();

function formatFlags(
  leftPadding: string,
  flag: string,
  value: any,
): string {
  return flag === '_'
    ? `${leftPadding}  ${(value as string[]).join(' ')}`
    : `${leftPadding}  --${flag}=${formatValue(value)}`;
}

function formatValue(value: any) {
  if (Array.isArray(value))
    return `[${value.join(',')}]`;
  else if (typeof value === 'object')
    return JSON.stringify(value);
  else
    return value;
}
interface Task {
  /**
   * Unique ID
   */
  id: string
  /**
   * Details about which project, target, and configuration to run.
   */
  target: {
    /**
     * The project for which the task belongs to
     */
    project: string
    /**
     * The target name which the task should invoke
     */
    target: string
    /**
     * The configuration of the target which the task invokes
     */
    configuration?: string
  }
  /**
   * Overrides for the configured options of the target
   */
  overrides: any
  /**
   * Root of the project the task belongs to
   */
  projectRoot?: string
  /**
   * Hash of the task which is used for caching.
   */
  hash?: string
  /**
   * Details about the composition of the hash
   */
  hashDetails?: {
    /**
     * Command of the task
     */
    command: string
    /**
     * Hashes of inputs used in the hash
     */
    nodes: { [name: string]: string }
    /**
     * Hashes of implicit dependencies which are included in the hash
     */
    implicitDeps?: { [fileName: string]: string }
    /**
     * Hash of the runtime environment which the task was executed
     */
    runtime?: { [input: string]: string }
  }
  /**
   *
   * Unix timestamp of when a Batch Task starts
   **/
  startTime?: number
  /**
   *
   * Unix timestamp of when a Batch Task ends
   **/
  endTime?: number
}

export interface CLIErrorMessageConfig {
  title: string
  bodyLines?: string[]
  slug?: string
}

export interface CLIWarnMessageConfig {
  title: string
  bodyLines?: string[]
  slug?: string
}

export interface CLINoteMessageConfig {
  title: string
  bodyLines?: string[]
}

export interface CLISuccessMessageConfig {
  title: string
  bodyLines?: string[]
}

/**
 * Automatically disable styling applied by chalk if CI=true
 */
const forceColor
  = process.env.FORCE_COLOR === '' || process.env.FORCE_COLOR === 'true';
if (isCI() && !forceColor)
  (chalk as any).level = 0;

/**
 * The following function is responsible for creating a life cycle with dynamic
 * outputs, meaning previous outputs can be rewritten or modified as new outputs
 * are added. It is therefore intended for use on a user's local machines.
 *
 * In CI environments the static equivalent of this life cycle should be used.
 *
 * NOTE: output.dim() should be preferred over output.colors.gray() because it
 * is much more consistently readable across different terminal color themes.
 */
export async function createRunManyDynamicOutputRenderer({
  projectNames,
  tasks,
  args,
  overrides,
}: {
  projectNames: string[]
  tasks: Task[]
  args: { targets?: string[]; configuration?: string; parallel: number }
  overrides: Record<string, unknown>
}): Promise<{ lifeCycle: any; renderIsDone: Promise<void> }> {
  cliCursor.hide();
  let resolveRenderIsDonePromise: (value: void) => void;
  const renderIsDone = new Promise<void>(
    resolve => (resolveRenderIsDonePromise = resolve),
  ).then(() => {
    clearRenderInterval();
    cliCursor.show();
  });

  const lifeCycle = {} as Partial<any>;
  const isVerbose = overrides.verbose === true;

  const start = process.hrtime();
  const figures = (await import('figures')).default;

  const targets = args.targets ?? [];
  const totalTasks = tasks.length;
  const taskRows = tasks.map((task) => {
    return {
      task,
      status: 'pending',
    };
  });

  const failedTasks = new Set();
  const tasksToTerminalOutputs: Record<string, string> = {};
  const tasksToProcessStartTimes: Record<
      string,
      ReturnType<NodeJS.HRTime>
    > = {};
  let hasTaskOutput = false;
  let pinnedFooterNumLines = 0;
  let totalCompletedTasks = 0;
  let totalSuccessfulTasks = 0;
  let totalFailedTasks = 0;
  let totalCachedTasks = 0;
  // Used to control the rendering of the spinner on each project row
  let currentFrame = 0;
  let renderIntervalId: NodeJS.Timeout | undefined;

  function clearRenderInterval() {
    if (renderIntervalId)
      clearInterval(renderIntervalId);
  }

  process.on('exit', () => clearRenderInterval());
  process.on('SIGINT', () => clearRenderInterval());
  process.on('SIGTERM', () => clearRenderInterval());
  process.on('SIGHUP', () => clearRenderInterval());

  const clearPinnedFooter = () => {
    for (let i = 0; i < pinnedFooterNumLines; i++) {
      readline.moveCursor(process.stdout, 0, -1);
      readline.clearLine(process.stdout, 0);
    }
  };

  const renderPinnedFooter = (lines: string[], dividerColor = 'cyan') => {
    let additionalLines = 0;
    if (hasTaskOutput) {
      output.addVerticalSeparator(dividerColor);
      additionalLines += 3;
    }
    // Create vertical breathing room for cursor position under the pinned footer
    lines.push('');
    for (const line of lines)
      process.stdout.write(output.X_PADDING + line + EOL);

    pinnedFooterNumLines = lines.length + additionalLines;
  };

  const printTaskResult = (task: Task, status: any) => {
    clearPinnedFooter();
    // If this is the very first output, add some vertical breathing room
    if (!hasTaskOutput)
      output.addNewline();

    hasTaskOutput = true;

    switch (status) {
      case 'local-cache':
        writeLine(
          `${
            `${output.colors.green(figures.tick)
            }  ${
            output.formatCommand(task.id)}`
          }  ${output.dim('[local cache]')}`,
        );
        if (isVerbose)
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);

        break;
      case 'local-cache-kept-existing':
        writeLine(
          `${
            `${output.colors.green(figures.tick)
            }  ${
            output.formatCommand(task.id)}`
          }  ${output.dim('[existing outputs match the cache, left as is]')}`,
        );
        if (isVerbose)
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);

        break;
      case 'remote-cache':
        writeLine(
          `${
            `${output.colors.green(figures.tick)
            }  ${
            output.formatCommand(task.id)}`
          }  ${output.dim('[remote cache]')}`,
        );
        if (isVerbose)
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);

        break;
      case 'success': {
        const timeTakenText = prettyTime(
          process.hrtime(tasksToProcessStartTimes[task.id]),
        );
        writeLine(
          `${output.colors.green(figures.tick)
            }  ${
            output.formatCommand(task.id)
            }${output.dim(` (${timeTakenText})`)}`,
        );
        if (isVerbose)
          writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);

        break;
      }
      case 'failure':
        output.addNewline();
        writeLine(
          `${output.colors.red(figures.cross)
            }  ${
            output.formatCommand(output.colors.red(task.id))}`,
        );
        writeCommandOutputBlock(tasksToTerminalOutputs[task.id]);
        break;
    }

    delete tasksToTerminalOutputs[task.id];
    renderPinnedFooter([]);
    renderRows();
  };

  const renderRows = () => {
    const max = dots.frames.length - 1;
    const curr = currentFrame;
    currentFrame = curr >= max ? 0 : curr + 1;

    const additionalFooterRows: string[] = [''];
    const runningTasks = taskRows.filter(row => row.status === 'running');
    const remainingTasks = totalTasks - totalCompletedTasks;

    if (runningTasks.length > 0) {
      additionalFooterRows.push(
        output.dim(
          `   ${output.colors.cyan(figures.arrowRight)}    Executing ${
            runningTasks.length
          }/${remainingTasks} remaining tasks${
            runningTasks.length > 1 ? ' in parallel' : ''
          }...`,
        ),
      );
      additionalFooterRows.push('');
      for (const runningTask of runningTasks) {
        additionalFooterRows.push(
          `   ${output.dim.cyan(
            dots.frames[currentFrame],
          )}    ${output.formatCommand(runningTask.task.id)}`,
        );
      }
      /**
       * Reduce layout thrashing by ensuring that there is a relatively consistent
       * height for the area in which the task rows are rendered.
       *
       * We can look at the parallel flag to know how many rows are likely to be
       * needed in the common case and always render that at least that many.
       */
      if (
        totalCompletedTasks !== totalTasks
        && Number.isInteger(args.parallel)
        && runningTasks.length < args.parallel
      ) {
        // Don't bother with this optimization if there are fewer tasks remaining than rows required
        if (remainingTasks >= args.parallel) {
          for (let i = runningTasks.length; i < args.parallel; i++)
            additionalFooterRows.push('');
        }
      }
    }

    if (totalSuccessfulTasks > 0 || totalFailedTasks > 0)
      additionalFooterRows.push('');

    if (totalSuccessfulTasks > 0) {
      additionalFooterRows.push(
        `   ${output.colors.green(
          figures.tick,
        )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
          `[${totalCachedTasks} read from cache]`,
        )}`,
      );
    }

    if (totalFailedTasks > 0) {
      additionalFooterRows.push(
        `   ${output.colors.red(
          figures.cross,
        )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} failed`,
      );
    }

    clearPinnedFooter();

    if (additionalFooterRows.length > 1) {
      const text = `Running ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks,
      )}`;
      const taskOverridesRows: string[] = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.cyan('With additional flags:')}`,
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.cyan(formatFlags(leftPadding, flag, value)),
          )
          .forEach(arg => taskOverridesRows.push(arg));
      }

      const pinnedFooterLines = [
        output.applyNxPrefix('cyan', output.colors.cyan(text)),
        ...taskOverridesRows,
        ...additionalFooterRows,
      ];

      // Vertical breathing room when there isn't yet any output or divider
      if (!hasTaskOutput)
        pinnedFooterLines.unshift('');

      renderPinnedFooter(pinnedFooterLines);
    }
    else {
      renderPinnedFooter([]);
    }
  };

  lifeCycle.startCommand = () => {
    if (projectNames.length <= 0) {
      renderPinnedFooter([
        '',
        output.applyNxPrefix(
          'gray',
          `No projects with ${formatTargetsAndProjects(
            projectNames,
            targets,
            tasks,
          )} were run`,
        ),
      ]);
      resolveRenderIsDonePromise();
      return;
    }
    renderPinnedFooter([]);
  };

  lifeCycle.endCommand = () => {
    clearRenderInterval();
    const timeTakenText = prettyTime(process.hrtime(start));

    clearPinnedFooter();
    if (totalSuccessfulTasks === totalTasks) {
      const text = `Successfully ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks,
      )}`;
      const taskOverridesRows: string[] = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.green('With additional flags:')}`,
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.green(formatFlags(leftPadding, flag, value)),
          )
          .forEach(arg => taskOverridesRows.push(arg));
      }

      const pinnedFooterLines = [
        output.applyNxPrefix(
          'green',
          output.colors.green(text) + output.dim.white(` (${timeTakenText})`),
        ),
        ...taskOverridesRows,
      ];
      if (totalCachedTasks > 0) {
        pinnedFooterLines.push(
          output.dim(
            `${EOL}   Nx read the output from the cache instead of running the command for ${totalCachedTasks} out of ${totalTasks} tasks.`,
          ),
        );
      }
      renderPinnedFooter(pinnedFooterLines, 'green');
    }
    else {
      const text = `Ran ${formatTargetsAndProjects(
        projectNames,
        targets,
        tasks,
      )}`;
      const taskOverridesRows: string[] = [];
      if (Object.keys(overrides).length > 0) {
        const leftPadding = `${output.X_PADDING}       `;
        taskOverridesRows.push('');
        taskOverridesRows.push(
          `${leftPadding}${output.dim.red('With additional flags:')}`,
        );
        Object.entries(overrides)
          .map(([flag, value]) =>
            output.dim.red(formatFlags(leftPadding, flag, value)),
          )
          .forEach(arg => taskOverridesRows.push(arg));
      }

      const numFailedToPrint = 5;
      const failedTasksForPrinting = Array.from(failedTasks).slice(
        0,
        numFailedToPrint,
      );
      const failureSummaryRows = [
        output.applyNxPrefix(
          'red',
          output.colors.red(text) + output.dim.white(` (${timeTakenText})`),
        ),
        ...taskOverridesRows,
        '',
        output.dim(
          `   ${output.dim(
            figures.tick,
          )}    ${totalSuccessfulTasks}${`/${totalCompletedTasks}`} succeeded ${output.dim(
            `[${totalCachedTasks} read from cache]`,
          )}`,
        ),
        '',
        `   ${output.colors.red(
          figures.cross,
        )}    ${totalFailedTasks}${`/${totalCompletedTasks}`} targets failed, including the following:`,
        `${failedTasksForPrinting
          .map(
            t =>
              `        ${output.colors.red('-')} ${output.formatCommand(
                t?.toString?.() ?? '',
              )}`,
          )
          .join('\n ')}`,
      ];

      if (failedTasks.size > numFailedToPrint) {
        failureSummaryRows.push(
          output.dim(
            `        ...and ${failedTasks.size - numFailedToPrint} more...`,
          ),
        );
      }

      failureSummaryRows.push(...viewLogsFooterRows(failedTasks.size));

      renderPinnedFooter(failureSummaryRows, 'red');
    }
    resolveRenderIsDonePromise();
  };

  lifeCycle.startTasks = (tasks: Task[]) => {
    for (const task of tasks)
      tasksToProcessStartTimes[task.id] = process.hrtime();

    for (const taskRow of taskRows) {
      if (tasks.includes(taskRow.task))
        taskRow.status = 'running';
    }
    if (!renderIntervalId)
      renderIntervalId = setInterval(renderRows, 100);
  };

  lifeCycle.printTaskTerminalOutput = (task, _cacheStatus, output) => {
    tasksToTerminalOutputs[task.id] = output;
  };

  lifeCycle.endTasks = (taskResults) => {
    for (const t of taskResults) {
      totalCompletedTasks++;
      const matchingTaskRow = taskRows.find(r => r.task === t.task);
      if (matchingTaskRow)
        matchingTaskRow.status = t.status;

      switch (t.status) {
        case 'remote-cache':
        case 'local-cache':
        case 'local-cache-kept-existing':
          totalCachedTasks++;
          totalSuccessfulTasks++;
          break;
        case 'success':
          totalSuccessfulTasks++;
          break;
        case 'failure':
          totalFailedTasks++;
          failedTasks.add(t.task.id);
          break;
      }
      printTaskResult(t.task, t.status);
    }
  };

  return { lifeCycle, renderIsDone };
}

function writeLine(line: string) {
  const additionalXPadding = '   ';
  process.stdout.write(output.X_PADDING + additionalXPadding + line + EOL);
}

/**
 * There's not much we can do in order to "neaten up" the outputs of
 * commands we do not control, but at the very least we can trim any
 * leading whitespace and any _excess_ trailing newlines so that there
 * isn't unncecessary vertical whitespace.
 */
function writeCommandOutputBlock(commandOutput: string) {
  commandOutput = commandOutput || '';
  commandOutput = commandOutput.trimStart();
  const additionalXPadding = '      ';
  const lines = commandOutput.split(EOL);
  let totalTrailingEmptyLines = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i] !== '')
      break;

    totalTrailingEmptyLines++;
  }
  if (totalTrailingEmptyLines > 1) {
    const linesToRemove = totalTrailingEmptyLines - 1;
    lines.splice(lines.length - linesToRemove, linesToRemove);
  }
  // Indent the command output to make it look more "designed" in the context of the dynamic output
  process.stdout.write(
    lines.map(l => `${output.X_PADDING}${additionalXPadding}${l}`).join(EOL)
      + EOL,
  );
}
function formatTargetsAndProjects(
  projectNames: string[],
  targets: string[],
  tasks: Task[],
) {
  if (!targets)
    return;
  if (tasks.length === 1)
    return `target ${targets[0]} for project ${projectNames[0]}`;

  let text;
  const project
    = projectNames.length === 1
      ? `project ${projectNames[0]}`
      : `${projectNames.length} projects`;
  if (targets.length === 1) {
    text = `target ${output.bold(targets[0])} for ${project}`;
  }
  else {
    text = `targets ${targets
      .map(t => output.bold(t))
      .join(', ')} for ${project}`;
  }

  const dependentTasks = tasks.filter(
    t =>
      !projectNames.includes(t.target.project)
      || !targets.includes(t.target.target),
  ).length;

  if (dependentTasks > 0) {
    text += ` and ${output.bold(dependentTasks)} ${
      dependentTasks === 1 ? 'task' : 'tasks'
    } ${projectNames.length === 1 ? 'it depends on' : 'they depend on'}`;
  }
  return text;
}

export function viewLogsFooterRows(failedTasks: number) {
  if (failedTasks >= 2)
    return ['', output.dim(`${output.X_PADDING} ${VIEW_LOGS_MESSAGE}`)];
  else
    return [];
}
