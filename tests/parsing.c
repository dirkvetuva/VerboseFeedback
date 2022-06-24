/* Author: Dirk Vet
 * Date: 2022/06/09
 *
 * This file contains dynamic error functions to test the functionality of the
 * Verbose Feedback extension.
 * The error functions are being called from main(). For testing the errors in
 * a specific function the code should be uncommented. The main() also contains
 * miscellaneous error tests.
 */

#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <limits.h>


/******************************************************************************
 * preprocessor_test()
 ******************************************************************************/

//#include "stdio.h"

// expected "FILENAME" or <FILENAME>
// #include string.h>
// expected '>'
//#include <string.h

//void tmp_helpfile();
// 'helpfile.h' file not found with <angled> include; use "quotes" instead
//#include <helpfile.h>

#include "helpfile.h"

// macro name missing
// #define

#define IF_MAC 1
// unterminated conditional directive
// #if IF_MAC
//     int GLOB_MACRO = 1;


const float const_glob = 10;
int glob = 20;


/******************************************************************************
 * helper function
 ******************************************************************************/
int *p(int amount)
{
    int *newp = (int *)malloc(amount);


    printf("%p\n", newp);

    return newp;
}


int recursion_test(int n) {
    // non-void function does not return a value in all control paths
    //if (n > 1)
    //    return n * recursion(n - 1);

    // all paths through this function will call itself
    //return n * recursion(n - 1);

    return n;
}

// address of stack memory associated with local variable 'a' returned
// int *return_int_arr() {
//     int a[] = {1,2,4};
//     return a;
// }


/******************************************************************************
 * helper function
 ******************************************************************************/
int return_int(int a, int b)
{
    // non-void function 'return_int' should return a value
    // return;

    // format specifies type 'double' but the argument has type 'int'
    // printf("%f", a);
    // format specifies type 'float *' but the argument has type 'int'
    // scanf("%f", a);

    // use of undeclared identifier 'c'
    // c = a + 1;

    return a + b;
}


/******************************************************************************
 * helper function
 ******************************************************************************/
void tmp()
{

    int a = 10;


    // use of undeclared identifier 'nonexist'
    // nonexist();
    // use of undeclared identifier 'tmpile'; did you mean 'tmpfile'? [Semantic Issue]
    // tmpile();

    // int a = 0;
    for (int i = 0; i < 10; i++)
    {
        for (int i = 0; i < 10; i++)
            a = i;
    }

    return;
    // void function 'tmp' should not return a value
    // return 0;
}

void zero_division_test() {
    // division by zero is undefined
    // int a = 5 / 0;
}

void if_test() {
    //int k = 10;

    // if statement has empty body
    // if (k > 0);

    // misleading indentation; statement is not part of the previous 'if'
    // if (k > 0)
    //     k = 10;
    //     k = 5;

    // misleading indentation; statement is not part of the previous 'else'
    // if (k > 0)
    //     k = 10;
    // else
    //     k = 4;
    //     k = 2;
    // if (k == 1)
    //     if (k == 2)
    //         k++;
    //     k--;
}

void ternary_operator_test() {
    // expected ':'
    // int b = 1==1 ? 10  20;
}

void goto_test() {
    // use of undeclared label 'tmp_label'
    // tmp_lael:
    // goto tmp_label;

    // expected identifier
    // goto;
}

void comment_test() {
    // /*
    // unterminated /* comment
}

void reserved_word_test() {
    // expected unqualified-id
    // char sizeof = 's';

    // cannot combine with previous 'char' declaration specifier
    // char float = 's';
}

void for_test() {
    //int k = 10;

    // misleading indentation; statement is not part of the previous 'for'
    // for (int i = 0; i < 10; i++)
    //     k = 0;
    //     k = 10;

    // expected ';' in 'for' statement specifier
    // for (i++;) {}

    // unexpected ';' before ')'
    // for (i++;;;) {}

    // for loop has empty body
    // for (i++;;); {}
}

void while_test() {
    //int k = 10;

    // while loop has empty body
    // while(1 == 1);
    // {
    // }

    // misleading indentation; statement is not part of the previous 'while'
    // while(1 == 1)
    //    k = 10;
    //    k = 2;

    // expected '(' after 'while'
    // while;
}

void continue_test() {
    // 'continue' statement not in loop statement
    // continue;

    // expected ';' after continue statement
    // for (int l = 0; l < 10; l++) {
    //     continue
    // }
}

void dowhile_test() {
    // expected 'while' in do/while loop
    // do {};
    // do;

    // expected '(' after 'while'
    // do while;

    // expected ';' after do/while statement
    // do {}
    // while (1)
}

void switch_test() {
    // int k = 10;

    // expected ':' after 'case'
    // switch(k) {
    //     case 1
    //     default
    // }

    // label at end of compound statement: expected statement
    // switch(k) {
    //     case 1:
    //     default:
    // }

    // expected ';' after break statement
    // switch(k) {
    //     case 1: break
    // }

    // duplicate case value '1'
    // multiple default labels in one switch
    // switch(k) {
    //     case 1: break;
    //     case 1: break;
    //     default: break;
    //     default: break;
    // }

    // statement requires expression of integer type ('char [3]' invalid)
    // char str[] = "42";
    // switch(str) {}


    // enumeration value 'ONE' not handled in switch [Semantic Issue]
    // enum testEnum {ZERO,ONE,TWO};
    // enum testEnum t = ZERO;
    // switch(t) {
    //     case ZERO:
    //     case TWO: break;
    // }
}

void string_test() {
    // int k = 10;

    // array initializer must be an initializer list or string literal
    // multi-character character constant
    // char arr[] = '123fsdfs';

    // array comparison always evaluates to false
    // char arr[5] = "hesy";
    // char arr2[5] = "hhdf";
    // if (arr == arr2) k = 2;

    // initializer-string for char array is too long
    //char arr[5] = "hello";

    // 'strncpy' size argument is too large; destination buffer has size 3, but size argument is 10
    // char arr[4] = "hey";
    // char arr2[3];
    // strncpy(arr2, arr, 10);
}

void array_test() {
    // int k = 2;

    // 'memcpy' will always overflow; destination buffer has size 3, but size argument is 4
    // int arr[3] = {1,2,3};
    // int arr2[3];
    // memcpy(arr2, arr, 4 * sizeof(int));
    // char arr[3];
    // memcpy(arr, "hello\0", 4 * sizeof(char));

    // definition of variable with array type needs an explicit size or an initializer
    // char arr[];
    // int arr[];

    // array type 'char [6]' is not assignable
    // char arr[6];
    // arr = "hello\0";
    // int arr[3];
    // arr = {1,2,3};

    // excess elements in array initializer
    // int arr[3] = {1,2,3,4};

    // variable-sized object may not be initialized
    // int multi[k][2] = {{1,2}, {3,4}};
    // int single[k] = {1,2};

    // array index 4 is past the end of the array (which contains 3 elements)
    // int arr[3] = {1,2,3};
    // int elem = arr[4];

    // array index -1 is before the beginning of the array
    // int arr[3] = {1,2,3};
    // int elem = arr[-1];

    // array comparison always evaluates to false
    // int arr[3] = {1,2,3};
    // int arr2[3] = {3,4,5};
    // if (arr == arr2) k = 2;
}

void pointer_test() {
    // assigning to 'int *' from incompatible type 'int'; take the address with &
    // int a = 1;
    // int *ptr_a;
    // ptr_a = a;

    // variable 'a' is uninitialized when used here
    // int a;
    // int b = a;
    // int *ptr;
    // *ptr = 1;

    // cannot initialize a variable of type 'int *' with an lvalue of type 'int'
    // int a[] = { 1 , 2 , 3 , 4 , 5 };
    // int *a_ptr = a[0];
    // char a[] = {'h','e','y'};
    // char *a_ptr = a[0];

    // cannot initialize a variable of type 'int *' with an rvalue of type 'int (*)[5]' [Semantic Issue]
    // int a[] = { 1 , 2 , 3 , 4 , 5 };
    // int *a_ptr = &a;
    // char a[] = {'h','e','y'};
    // char *a_ptr = &a;
}

void struct_test() {
    // struct coord_struct {
    //     int x;
    //     int y;
    // };

    // excess elements in struct initializer
    // struct coord_struct coord = {1, 2, 3};

    // missing field 'y' initializer
    // struct coord_struct coord = {1};

    // member reference type 'struct coord_struct' is not a pointer; did you mean to use '.'?
    // struct coord_struct coord = {1, 2};
    // int x = coord->x;

    // typedef requires a name
    //  typedef struct coord_struct {
    //      int x;
    //      int y;
    //  };
}

void union_test() {
    // member reference type 'union left_right' is not a pointer; did you mean to use '.'?
    // union left_right {
    //     float left ;
    //     int right ;
    // };
    // union left_right lu ;
    // lu->left = 3.55;
}

void overflow_test() {
    //overflow in expression; result is -1 with type 'int'
    //  int l = INT_MAX - INT_MIN;
    //  int p = INT_MIN - INT_MAX;
    //  long long a = LLONG_MAX * LLONG_MAX;
    //  long s = LONG_MAX * LONG_MIN;
}

/*******************************************************************************
 * main_test()
 ******************************************************************************/
// 'main' must return 'int'
// float main() {

// redefinition of 'main'
// int main() {
//    return 1.9;
//}


/*******************************************************************************
 * general_test()
 *
 * contains miscellaneous errors and calls to the test functions above.
 ******************************************************************************/

// extraneous closing brace ('}')
// REMOVE BELOW {
int main()
{
    int k = 2;
    float f = 4.5;
    recursion_test(5);
    return_int(4, 6);
    tmp_helpfile();

    if_test();
    for_test();
    goto_test();
    array_test();
    union_test();
    while_test();
    string_test();
    struct_test();
    switch_test();
    comment_test();
    dowhile_test();
    pointer_test();
    continue_test();
    overflow_test();
    ternary_operator_test();
    zero_division_test();
    reserved_word_test();


    // "expected ';' after expression"
    // int a;
    // a = 4

    // cannot assign to variable 'glob' with const-qualified type 'const float'
    // const_glob = 2;

    // use of undeclared identifier 'flat'; did you mean 'float'?
    // flat f = 4.5;

    // redefinition of 'f'
    // float f = 10.0;
    // float f;

    // redefinition of 'f' with a different type: 'double' vs 'float'
    // double f = 5.6;

    // expected ';' at end of declaration.
    // float f = 4.5

    // missing terminating '"' character
    // char s[10] = "thsklh;

    // missing terminating ' character
    // char s[10] = 'thsklh;

    // expected ']'
    // char s[11 = "2342dfs.";

    // extraneous ')' before ';'
    // int a = 28 % (4 + 5) * 1);

    // expected ')'
    // int a = 28 % ((4 + 5) * 1;

    // no matching function for call to 'p'
    // candidate function not viable: requires single argument 'amount', but 2 arguments were provided
    // p(3, 5);
    // p();
    // return_int();
    // tmp(1);
    // printf():
    // scanf();
    // fopen();

    // C++ requires a type specifier for all declarations
    // const constant = 10;

    return 0;

    // "expected ';' after return statement"
    // return 0

    // non-void function 'main' should return a value
    // return;

    // expected '}'
    // REMOVE BELOW }
}









