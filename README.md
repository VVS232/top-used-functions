
# Find most used functions in your code

This utility is goes takes glob as input (currently glob shoud end with ".js" extension), goes through all the files and count how many times each function is used. If your project have low test coverage, it can be useful to find out, what parts of the code are used most and should be covered first.

# Usage
npx rate-usages glob <br>  <br>
(npx rate-usages ./my-code-here/**/*.js -- please use forward shashes)

# Example output
{ <br>
  'a' => { count: 1, path: Set(1) { './test-resources/a.js' } }, <br>
  'b3' => { count: 1, path: Set(1) { './test-resources/b.js' } }, <br>
  'b1' => { count: 0, path: Set(1) { './test-resources/b.js' } }, <br>
  'b2' => { count: 0, path: Set(1) { './test-resources/b.js' } } <br>
} 

Any issues and PRs are welcome. This is extra alfa version, so if you find the idea useful and have any improvement in mind - go ahead and tell me.
