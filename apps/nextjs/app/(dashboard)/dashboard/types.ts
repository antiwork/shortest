export interface PullRequest {
  id: number;
  title: string;
  number: number;
  buildStatus: string;
  isDraft: boolean;
  branchName: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: {
      login: string;
    };
  };
}

export interface TestFile {
  name: string;
  content: string;
  oldContent?: string;
}

export type CommitChangesToPullRequest = (
  owner: string,
  repo: string,
  pullNumber: number,
  filesToCommit: TestFile[],
  commitMessage: string,
) => Promise<string>;

export interface LogGroup {
  id: string;
  name: string;
  logs: string[];
}
