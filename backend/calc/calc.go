package calc

import "math"

func Calculate(operation string, a, b float64) (float64, error) {
	var result float64
	switch operation {
	case OpAdd:
		result = a + b
	case OpSub:
		result = a - b
	case OpMul:
		result = a * b
	case OpDiv:
		if b == 0 {
			return 0, ErrDivisionByZero
		}
		result = a / b
	case OpExp:
		result = math.Pow(a, b)
	case OpSqrt:
		if a < 0 {
			return 0, ErrNegativeSqrt
		}
		result = math.Sqrt(a)
	case OpPercent:
		result = a / percentDivisor
	default:
		return 0, ErrUnknownOp
	}
	if math.IsNaN(result) || math.IsInf(result, 0) {
		return 0, ErrNonFinite
	}
	return result, nil
}
