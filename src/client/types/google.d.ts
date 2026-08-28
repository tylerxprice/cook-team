declare namespace google {
  namespace script {
    interface Runner {
      withSuccessHandler(callback: (result: any, userObject?: any) => void): Runner;
      withFailureHandler(callback: (error: Error, userObject?: any) => void): Runner;
      withUserObject(userObject: any): Runner;
      [functionName: string]: any;
    }

    const run: Runner;

    namespace host {
      function close(): void;
      function setHeight(height: number): void;
      function setWidth(width: number): void;
      namespace editor {
        function focus(): void;
      }
    }

    namespace url {
      function getLocation(callback: (location: {
        hash: string;
        parameter: Record<string, string>;
        parameters: Record<string, string[]>;
      }) => void): void;
    }
  }
}
