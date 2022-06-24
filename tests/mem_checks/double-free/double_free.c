/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file simulates a double free error.
 * This is used for testing the functionality of the Verbose Feedback extension.
 */


#include <stdlib.h>
#include <stdio.h>
#include <string.h>

void *p(int amount) {
    void *newp = (void *)malloc(amount);
    return newp;
}


void tmp(int *j) {
    free(j);
}

int main() {
    int *i = (int *)p(100);
    *i = 1;

    tmp(i);
    free(i);

    return 0;
}

