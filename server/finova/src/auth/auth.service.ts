import { Injectable } from "@nestjs/common";

@Injectable()
export class AuthService{
    login(){
        return {msg: 'Logged in'}
    }

    signup(){
        return {msg: 'Signed up'}
    }
}