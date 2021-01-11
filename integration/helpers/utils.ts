import { AppConstructorOptions, Application } from "spectron";
import * as util from "util";
import { exec } from "child_process";
import fse from "fs-extra";
import path from "path";

interface AppTestingPaths {
  testingPath: string,
  libraryPath: string,
}

function getAppTestingPaths(): AppTestingPaths {
  switch (process.platform) {
    case "win32":
      return {
        testingPath: "./dist/win-unpacked/Lens.exe",
        libraryPath: path.join(process.env.APPDATA, "Lens"),
      };
    case "linux":
      return {
        testingPath: "./dist/linux-unpacked/kontena-lens",
        libraryPath: path.join(process.env.XDG_CONFIG_HOME || path.join(process.env.HOME, ".config"), "Lens"),
      };
    case "darwin":
      return {
        testingPath: "./dist/mac/Lens.app/Contents/MacOS/Lens",
        libraryPath: path.join(process.env.HOME, "Library/Application\ Support/Lens"),
      };
    default:
      throw new TypeError(`platform ${process.platform} is not supported`);
  }
}

export function itIf(condition: boolean) {
  return condition ? it : it.skip;
}

export function describeIf(condition: boolean) {
  return condition ? describe : describe.skip;
}

export function setup(): AppConstructorOptions {
  const appPath = getAppTestingPaths();

  fse.removeSync(appPath.libraryPath); // remove old install config

  return {
    path: appPath.testingPath,
    args: [],
    startTimeout: 30000,
    waitTimeout: 60000,
    env: {
      CICD: "true"
    }
  };
}

type HelmRepository = {
  name: string;
  url: string;
};
type AsyncPidGetter = () => Promise<number>;
export const promiseExec = util.promisify(exec);

export async function tearDown(app: Application) {
  const pid = await (app.mainProcess.pid as any as AsyncPidGetter)();

  await app.stop();

  try {
    process.kill(pid, "SIGKILL");
  } catch (e) {
    console.error(e);
  }
}

export async function listHelmRepositories(retries = 0):  Promise<HelmRepository[]>{
  if (retries < 5) {
    try {
      const { stdout: reposJson } = await promiseExec("helm repo list -o json");

      return JSON.parse(reposJson);
    } catch {
      await new Promise(r => setTimeout(r, 2000)); // if no repositories, wait for Lens adding bitnami repository

      return await listHelmRepositories((retries + 1));
    }
  }

  return [];
}
