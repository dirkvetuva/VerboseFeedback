/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file simulates a stack-use-after-scope error.
 * This is used for testing the functionality of the Verbose Feedback extension.
 *
 * Code from: https://docs.microsoft.com/en-us/cpp/sanitizers/error-stack-use-after-scope?view=msvc-170
 */


#include <stdlib.h>
#include <stdio.h>
#include <string.h>

int *gp;

int main() {
    if (1==1) {
        int yvar[5];
        gp = yvar + 1;
    }
    int i = 20 + *gp;
    return i;

}
