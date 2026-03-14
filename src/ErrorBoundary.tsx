import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {

  constructor(props:any) {
    super(props)
    this.state = { hasError:false }
  }

  static getDerivedStateFromError(error:any) {

    console.log("ErrorBoundary発動")

    return { hasError:true }
  }

  componentDidCatch(error:any, info:any) {

    console.log("Reactエラー検知")
    console.error(error)
    console.error(info)

    alert("Reactエラー発生\n\n" + error)

  }

  render() {

    if (this.state.hasError) {
      return (
        <div style={{
          padding:40,
          fontSize:20,
          color:"red"
        }}>
          ErrorBoundaryが動作しました
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary