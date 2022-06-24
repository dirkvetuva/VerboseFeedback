/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file simulates a memory leak error.
 * This is used for testing the functionality of the Verbose Feedback extension.
 */


#include <stdlib.h>
#include <stdio.h>
#include <string.h>

int main() {

    int *i = (int *)malloc(100);;
    *i = 1;

    int *j = (int *)malloc(100);
    *j = 2;

    return 0;
}
