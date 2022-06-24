/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file simulates a stack-buffer-overflow error.
 * This is used for testing the functionality of the Verbose Feedback extension.
 *
 * Code from: https://en.wikipedia.org/wiki/Stack_buffer_overflow
 */


#include <stdlib.h>
#include <stdio.h>
#include <string.h>

void copy_str(char *str) {
    char c_buf[12];

    strcpy(c_buf, str);
}

int main() {
    copy_str("hello this string is longer than 12 chars.");

    printf("100000\n");


    return 0;
}

