/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file simulates a dereference-null-pointer error.
 * This is used for testing the functionality of the Verbose Feedback extension.
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>

int main() {
    printf("%d\n", 100555);

    int *i = NULL;
    *i = 16;

    return 0;
}

