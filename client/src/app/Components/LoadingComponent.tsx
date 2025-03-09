"use client"

import { BookCopy, Bot, Laptop, ReceiptText } from "lucide-react"
import * as motion from "motion/react-client"
import { useEffect, useState } from "react"


export default function LoadingComponent() {
    const [order, setOrder] = useState(initialOrder)

    useEffect(() => {
        const timeout = setTimeout(() => setOrder(shuffle(order)), 1000)
        return () => clearTimeout(timeout)
    }, [order])

    return (
        <ul style={container} >
            {order.map((element) => (
                <motion.li
                    key={element.color}
                    layout
                    transition={spring}
                    style={{ ...item, backgroundColor: "transparent" }}
                    className="flex justify-center items-center text-2xl font-bold"
                >{element.icon}</motion.li>
            ))}
        </ul>
    )
}

const initialOrder = [
    {
      color: "#5271FF",
      icon: <Bot size={100} className="text-[#5271FF]"></Bot>
    },
    {
      color: "#85A9FF",
      icon: <BookCopy size={100} className="text-[#2e45aa]"></BookCopy>
    },
    {
      color: "#1E3D96",
      icon: <Laptop size={100} className="text-[#6b86fc]"></Laptop>
    },
    {
      color: "#4EF0F0",
      icon: <ReceiptText size={100} className="text-[#9fb0f9]"></ReceiptText>
    }
]

type elem ={
  color: string,
  icon: any
}
/**
 * ==============   Utils   ================
 */
function shuffle([...array]: elem[]) {
    return array.sort(() => Math.random() - 0.5)
}

/**
 * ==============   Styles   ================
 */

const spring = {
    type: "spring",
    damping: 20,
    stiffness: 300,
}

const container: React.CSSProperties = {
    listStyle: "none",
    padding: 0,
    margin: 0,
    position: "relative",
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
}

const item: React.CSSProperties = {
    width: 50,
    height: 50,
    borderRadius: "10px",
}
