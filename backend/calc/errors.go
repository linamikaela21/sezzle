package calc

import "errors"

const (
	OpAdd     = "add"
	OpSub     = "sub"
	OpMul     = "mul"
	OpDiv     = "div"
	OpExp     = "exp"
	OpSqrt    = "sqrt"
	OpPercent = "percent"

	percentDivisor = 100

	msgDivisionByZero = "division by zero"
	msgNegativeSqrt   = "square root of negative number"
	msgNonFinite      = "non-finite result"
	msgUnknownOp      = "unknown operation"
)

var (
	ErrDivisionByZero = errors.New(msgDivisionByZero)
	ErrNegativeSqrt   = errors.New(msgNegativeSqrt)
	ErrNonFinite      = errors.New(msgNonFinite)
	ErrUnknownOp      = errors.New(msgUnknownOp)
)
