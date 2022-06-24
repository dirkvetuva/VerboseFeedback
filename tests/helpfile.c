/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file contains a function that is only meant for linking purposes. This
 * is used for testing the functionality of the Verbose Feedback extension.
 */

#include "helpfile.h"


void tmp_helpfile() {
    int a = 10;

    for (int i = 0; i < 10; i++) {
        for (int i = 0; i < 10; i++)
            a = i;
    }

    return;
}
