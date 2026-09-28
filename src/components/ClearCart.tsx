"use client";
import { useEffect } from "react";
import { cart } from "@/lib/cartStore";
export default function ClearCart() { useEffect(() => { cart.clear(); }, []); return null; }
