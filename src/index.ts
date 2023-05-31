// import { createRunManyDynamicOutputRenderer } from './dynamic-run-many-terminal-output-life-cycle'
import { createRunManyDynamicOutputRenderer } from './main'

async function main() {
  const taskA = {
    /**
     * Unique ID
     */
    id: 'app:build',
    /**
     * Details about which project, target, and configuration to run.
     */
    target: {
      /**
       * The project for which the task belongs to
       */
      project: 'app',
      /**
       * The target name which the task should invoke
       */
      target: 'hello',
    },
    overrides: {},
  };

  const taskB = {
    /**
     * Unique ID
     */
    id: 'component:build',
    /**
     * Details about which project, target, and configuration to run.
     */
    target: {
      /**
       * The project for which the task belongs to
       */
      project: 'component',
      /**
       * The target name which the task should invoke
       */
      target: 'component:111',
    },
    overrides: {},
  };

  const { renderIsDone, lifeCycle } = await createRunManyDynamicOutputRenderer({
    args: {
      parallel: 100,
    },
    overrides: {},
    projectNames: ['component', 'app'],
    tasks: [
      taskA, taskB,
    ],
  })

  lifeCycle.startTasks([taskA, taskB], { groupId: 1111 });
  setTimeout(() => {
    lifeCycle.printTaskTerminalOutput(taskA, 'local-cache', 'hahaha, I am cached');
  }, 500);
  setTimeout(() => {
    lifeCycle.printTaskTerminalOutput(taskB, 'local-cache', 'hahaha, I am cached');
  }, 500);
  setTimeout(() => {
    lifeCycle.endTasks([{ code: 200, status: 'success', task: taskA, terminalOutput: 'I am end' }], { groupId: 1111 });
  }, 1000);

  setTimeout(() => {
    lifeCycle.endTasks([{
      code: 200, status: 'success', task: taskB, terminalOutput: 'I am end B',
    }], { groupId: 1111 })
  }, 2000);

  lifeCycle.endCommand();
  await renderIsDone;
}

main()
;
