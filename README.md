
## SMTChecker Problem Reproducer

Reproduce the bug via:
* clone this repository
* switch to this branch `smtchecker-problem`
* install `jq`
* `npm ci` to install sloc `^0.8.19`
* `npm run compile` to get the following error

```
Warning: CHC: Underflow (resulting value less than 0) might happen here.
  --> Reproducer.sol:27:26:
   |
27 |             sentAmount = msg.value - 0;
   |                          ^^^^^^^^^^^^^

```

This is very unxpected, as the logic in the code doesn't suggest, that this is an error!

