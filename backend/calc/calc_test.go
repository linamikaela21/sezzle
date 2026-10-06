package calc

import (
	"math"
	"testing"
)

func TestCalculate(t *testing.T) {
	tests := []struct {
		name string
		op   string
		a, b float64
		want float64
		err  error
	}{
		{name: "add", op: OpAdd, a: 200, b: 20, want: 220},
		{name: "sub", op: OpSub, a: 5, b: 3, want: 2},
		{name: "sub negative", op: OpSub, a: 3, b: 5, want: -2},
		{name: "mul", op: OpMul, a: 4, b: 2.5, want: 10},
		{name: "div", op: OpDiv, a: 8, b: 2, want: 4},
		{name: "div by zero", op: OpDiv, a: 1, b: 0, err: ErrDivisionByZero},
		{name: "exp", op: OpExp, a: 2, b: 10, want: 1024},
		{name: "sqrt ignores b", op: OpSqrt, a: 9, b: 123, want: 3},
		{name: "sqrt zero", op: OpSqrt, a: 0, b: 1, want: 0},
		{name: "sqrt negative", op: OpSqrt, a: -4, b: 0, err: ErrNegativeSqrt},
		{name: "percent", op: OpPercent, a: 50, b: 99, want: 0.5},
		{name: "unknown", op: "mod", a: 1, b: 1, err: ErrUnknownOp},
		{name: "empty operation", op: "", a: 1, b: 1, err: ErrUnknownOp},
		{name: "overflow mul", op: OpMul, a: math.MaxFloat64, b: 2, err: ErrNonFinite},
		{name: "overflow add", op: OpAdd, a: math.MaxFloat64, b: math.MaxFloat64, err: ErrNonFinite},
		{name: "overflow sub", op: OpSub, a: -math.MaxFloat64, b: math.MaxFloat64, err: ErrNonFinite},
		{name: "overflow exp", op: OpExp, a: 10, b: 400, err: ErrNonFinite},
		{name: "pow nan", op: OpExp, a: -2, b: 0.5, err: ErrNonFinite},
		{name: "zero to zero", op: OpExp, a: 0, b: 0, want: 1},
		{name: "negative zero divisor", op: OpDiv, a: 4, b: math.Copysign(0, -1), err: ErrDivisionByZero},
		{name: "percent negative", op: OpPercent, a: -50, b: 0, want: -0.5},
		{name: "percent zero", op: OpPercent, a: 0, b: 8, want: 0},
		{name: "div negative", op: OpDiv, a: -9, b: 3, want: -3},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.op, tt.a, tt.b)
			if tt.err != nil {
				if err != tt.err {
					t.Fatalf("Calculate() error = %v, want %v", err, tt.err)
				}
				return
			}
			if err != nil {
				t.Fatalf("Calculate() unexpected error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("Calculate() = %v, want %v", got, tt.want)
			}
		})
	}
}
