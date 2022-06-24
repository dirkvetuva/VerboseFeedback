# Verbose Feedback VScode Extension
This extension returns error messages from the GCC and Clang compiler with feedback. The objective of this extension is to improve the learning process of novice C programmers.<br>
The code is based on the 'C/C++ Advanced Lint for VS Code' extension from Joseph Benden (https://github.com/jbenden/vscode-c-cpp-flylint)

Original author: Joseph Benden<br>
Edited by: Dirk Vet

## License

Copyright (C) 2017-2021 [Joseph Benden](mailto:joe@benden.us).

Licensed under the [MIT License](https://opensource.org/licenses/MIT).

## Dependencies
The extension has been developed on Ubuntu 20.04.4 LTS <br>
VScode: 1.67.2<br>
Node.js: 16.2.0<br>
npm: 8.7.0<br>
GCC: 9.4.0<br>
Clang: 10.0.0-4ubuntu1 <br>
bash timeout command <br>


## Build
To build the project use `npm install` inside the project root
Next use `npm run compile` or `npm run watch` to build the server. This will create the `client/out` and `server/out` directories with the compiled server. You will also need to install the Microsoft C/C++ extension, but that can also be installed during debugging.

In case of problems look at the "Development Setup" in the README.md file from Joseph Benden (https://github.com/jbenden/vscode-c-cpp-flylint).
