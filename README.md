
## SMTChecker Problem Reproducer

Reproduce the bug via:
* clone this repository
* switch to this branch `smtchecker-problem`
* install `jq` and `z3` (ubuntu package, 4.8.10 is latest)
* `npm ci` to install sloc `^0.8.19`
* `npm run compile` to get the following error (with some formatting)
  * output of compilation is saved into out.log and out.err

```
Warning: CHC: Underflow (resulting value less than 0) might happen here.
  --> Reproducer.sol:20:26:
   |
20 |             sentAmount = msg.value - 0;
   |                          ^^^^^^^^^^^^^
```

This is very unxpected, as the logic in the code doesn't suggest, that this is an error!

Furthermore, what is even more unexpected, is that changing even unrelated lines (e.g. removing the secondParam)
from the function changes the output of the analysis.

I encounted this error on a Ubuntu LTE 22.04 and reporduced it on two different machines.
